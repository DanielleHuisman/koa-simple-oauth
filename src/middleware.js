import randomstring from 'randomstring';
import simpleOauth2 from 'simple-oauth2';
import fetch from 'node-fetch';

export default ({
    clientId,
    clientSecret,
    url,
    redirectUrl,
    userUrl,
    userMethod = 'GET',
    getUser = (data) => data.user,
    oauthOptions = {},
    redirectSuccessUrl,
    redirectErrorUrl,
    disableErrorReason = false,
    onSuccess = () => {},
    onError = () => {},
    logError = () => {}
}) => {
    // Initialize OAuth
    const oauth2 = simpleOauth2.create({
        ...oauthOptions,
        client: {
            id: clientId,
            secret: clientSecret,
            ...oauthOptions.client
        },
        auth: {
            tokenHost: url,
            ...oauthOptions.auth
        }
    });

    // Define redirect error helper
    const redirectError = (ctx, reason) => ctx.redirect(disableErrorReason ? redirectErrorUrl : `${redirectErrorUrl}?error=${reason}`);

    // Login endpoint
    const login = async (ctx) => {
        try {
            // Generate state
            const state = randomstring.generate(32);
            ctx.session.state = state;

            // Store the redirect URL
            if (ctx.query.redirect) {
                ctx.session.redirect = ctx.query.redirect;
            } else {
                ctx.session.redirect = redirectSuccessUrl;
            }

            // Redirect to OAuth provider
            const url = oauth2.authorizationCode.authorizeURL({
                redirect_uri: redirectUrl,
                scope: 'read',
                state: state
            });
            ctx.redirect(url);
        } catch (err) {
            logError(err);
            return redirectError(ctx, 'unknown');
        }
    };

    // Authorized endpoint
    const authorized = async (ctx) => {
        try {
            if (!ctx.query.code || !ctx.query.state || ctx.query.state !== ctx.session.state) {
                const err = new Error('Invalid code or state');
                logError(err);
                return redirectError(ctx, 'invalid_code_or_state');
            }

            // Request access token
            const result = await oauth2.authorizationCode.getToken({
                redirect_uri: redirectUrl,
                code: ctx.query.code
            });
            const accessToken = oauth2.accessToken.create(result);

            // Fetch user details
            const response = await fetch(`${userUrl}?access_token=${accessToken.token.access_token}`, {
                method: userMethod
            });
            if (response.ok) {
                // Parse response
                const data = await response.json();

                // Extract the user data from the reponse
                const user = getUser(data);
                if (!user || typeof user === 'string') {
                    const reason = typeof user === 'string' ? user : 'invalid_user';
                    const err = new Error(`Failed to extract user: ${reason}`);
                    logError(err, response);
                    return redirectError(ctx, reason);
                }

                // Login was successful, redirect to the original URL
                ctx.session.user = user;
                ctx.session.token = accessToken.token;
                return ctx.redirect(ctx.session.redirect);
            } else {
                // Login failed, redirect to the error page
                const err = new Error('Failed to fetch user');
                logError(err, response);
                return redirectError(ctx, 'user_fetch_failed');
            }
        } catch (err) {
            logError(err);
            return redirectError(ctx, 'unknown');
        }
    };

    // Whoami endpoint
    const whoami = async (ctx) => {
        try {
            // Check if the user is logged in and the token is still valid
            if (ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user) {
                return onSuccess(ctx, ctx.session.user);
            } else {
                const err = new Error('Not logged in');
                logError(err);
                return onError(ctx, 401, 'Not logged in', err);
            }
        } catch (err) {
            logError(err);
            return onError(ctx, 500, 'An unexpected error occurred', err);
        }
    };

    // Logout endpoint
    const logout = async (ctx) => {
        try {
            // Delete stored access token and user details
            ctx.session.token = null;
            ctx.session.user = null;
            return onSuccess(ctx, null, 204);
        } catch (err) {
            logError(err);
            return onError(ctx, 500, 'An unexpected error occurred', err);
        }
    };

    // Is logged in middleware
    const isLoggedIn = async (ctx, next) => {
        ctx.state.isLoggedIn = () => ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user;
        await next();
    };

    // Require login middleware
    const requireLogin = async (ctx, next) => {
        // Check if the user is logged in and the token is still valid
        if (ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user) {
            await next();
        } else {
            const err = new Error('Not logged in');
            logError(err);
            return onError(ctx, 401, 'Not logged in', err);
        }
    };

    return {
        login,
        authorized,
        whoami,
        logout,
        isLoggedIn,
        requireLogin
    };
};
