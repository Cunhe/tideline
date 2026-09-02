import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
  parseSetCookieHeader,
  setRequestCookie,
  setSessionCookie,
} from "better-auth/cookies";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import {
  GATE_IDENTITY_HEADER,
  gateIdentityEnabled,
  gateIdentityFromHeaders,
  sessionBoundToGateIdentity,
} from "./gate-identity.server";

export const GATE_PROVIDER_ID = "grok-gate";
const GATE_ACCOUNT_ISSUER = "https://grok.com";
const LOG = "[gate-identity]";

type GateAccount = Parameters<typeof handleOAuthUserInfo>[1]["account"];

async function emitSessionCookie(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  sessionTokenName: string,
  sessionToken: string,
): Promise<string | null> {
  const attributes = ctx.context.authCookies.sessionToken.attributes;
  const maxAge = ctx.context.sessionConfig.expiresIn;
  const cookieOptions = {
    ...attributes,
    maxAge,
  };

  let signedCookie: string;
  try {
    signedCookie = await ctx.setSignedCookie(
      sessionTokenName,
      sessionToken,
      ctx.context.secret,
      cookieOptions,
    );
  } catch (err) {
    console.error(`${LOG} setSignedCookie failed`, err);
    return null;
  }

  const sessionValue = parseSetCookieHeader(signedCookie).get(
    sessionTokenName,
  )?.value;
  if (!sessionValue) {
    console.error(`${LOG} signed Set-Cookie missing session token value`, {
      cookiePreview: signedCookie.slice(0, 120),
    });
    return null;
  }

  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(sessionTokenName, sessionValue, {
      path: cookieOptions.path ?? "/",
      httpOnly: cookieOptions.httpOnly ?? true,
      secure: cookieOptions.secure ?? true,
      sameSite: (cookieOptions.sameSite as "lax" | "strict" | "none") ?? "lax",
      maxAge: typeof maxAge === "number" ? maxAge : undefined,
      domain: cookieOptions.domain,
    });
  } catch (err) {
    console.error(`${LOG} TanStack setCookie failed`, err);
  }

  try {
    const responseHeaders = ctx.context.responseHeaders;
    if (responseHeaders) {
      responseHeaders.append("set-cookie", signedCookie);
    } else {
      console.error(`${LOG} ctx.context.responseHeaders is missing`);
    }
  } catch (err) {
    console.error(`${LOG} responseHeaders.append(set-cookie) failed`, err);
  }

  return sessionValue;
}

async function expireSessionDataCookie(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
  cookie: { name: string; attributes: { path?: string; secure?: boolean } },
): Promise<void> {
  const path = cookie.attributes.path ?? "/";
  const secure = cookie.attributes.secure ?? true;
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(cookie.name, "", {
      path,
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 0,
    });
  } catch (err) {
    console.error(`${LOG} TanStack setCookie (expire session_data) failed`, err);
  }
  try {
    ctx.context.responseHeaders?.append(
      "set-cookie",
      `${cookie.name}=; Path=${path}; HttpOnly; ` +
        `${secure ? "Secure; " : ""}SameSite=Lax; Max-Age=0`,
    );
  } catch (err) {
    console.error(
      `${LOG} responseHeaders.append (expire session_data) failed`,
      err,
    );
  }
}

function removeRequestCookie(headers: Headers, name: string): void {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return;
  const kept = cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !pair.startsWith(`${name}=`));
  if (kept.length > 0) {
    headers.set("cookie", kept.join("; "));
  } else {
    headers.delete("cookie");
  }
}

export function gateIdentitySessions() {
  return {
    id: "grok-gate-identity",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            if (!gateIdentityEnabled()) return;
            const inbound = ctx.request?.headers ?? ctx.headers;
            if (!inbound) {
              console.error(`${LOG} no request headers on /get-session`);
              return;
            }
            if (inbound.get("authorization")) return;
            if (!inbound.get(GATE_IDENTITY_HEADER)) return;

            const identity = await gateIdentityFromHeaders(inbound);
            if (!identity) {
              console.error(
                `${LOG} ${GATE_IDENTITY_HEADER} present but verification failed`,
              );
              return;
            }

            const sessionCookieName = ctx.context.authCookies.sessionToken.name;
            const cookieHeader = inbound.get("cookie") ?? "";
            if (cookieHeader.includes(`${sessionCookieName}=`)) {
              const existing = await getSessionFromCtx(ctx).catch((err) => {
                console.error(`${LOG} getSessionFromCtx failed`, err);
                return null;
              });
              if (existing?.session && existing.user) {
                const accounts = await ctx.context.internalAdapter
                  .findAccounts(existing.user.id)
                  .catch((err) => {
                    console.error(`${LOG} findAccounts failed`, err);
                    return null;
                  });
                if (!accounts) {
                  console.error(
                    `${LOG} could not load accounts for existing session user`,
                    { userId: existing.user.id },
                  );
                  return;
                }
                if (
                  sessionBoundToGateIdentity(
                    accounts,
                    identity.sub,
                    GATE_PROVIDER_ID,
                  )
                ) {
                  return;
                }
                await ctx.context.internalAdapter
                  .deleteSession(existing.session.token)
                  .catch((err) => {
                    console.error(
                      `${LOG} deleteSession (stale non-gate session) failed`,
                      err,
                    );
                    return null;
                  });
              }
            }

            try {
              const result = await handleOAuthUserInfo(ctx, {
                userInfo: {
                  id: identity.sub,
                  email: (
                    identity.email ?? `${identity.sub}@viewer.grok.invalid`
                  ).toLowerCase(),
                  emailVerified: Boolean(identity.email),
                  name: identity.name ?? "Grok user",
                },
                account: {
                  providerId: GATE_PROVIDER_ID,
                  issuer: GATE_ACCOUNT_ISSUER,
                  accountId: identity.sub,
                } as GateAccount,
              });
              if (result.error || !result.data) {
                console.error(`${LOG} handleOAuthUserInfo failed`, {
                  error: result.error,
                  hasData: Boolean(result.data),
                  sub: identity.sub,
                });
                return;
              }

              await setSessionCookie(ctx, result.data);

              const sessionValue = await emitSessionCookie(
                ctx,
                sessionCookieName,
                result.data.session.token,
              );
              if (!sessionValue) {
                console.error(
                  `${LOG} session created in DB but cookie was not emitted`,
                  { userId: result.data.user.id },
                );
                return;
              }

              const sessionDataCookie = ctx.context.authCookies.sessionData;
              await expireSessionDataCookie(ctx, sessionDataCookie);

              const headers = new Headers(
                Object.fromEntries(inbound.entries()),
              );
              setRequestCookie(headers, sessionCookieName, sessionValue);
              removeRequestCookie(headers, sessionDataCookie.name);
              return { context: { headers } };
            } catch (err) {
              console.error(`${LOG} gate identity session hook threw`, err);
              return;
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
