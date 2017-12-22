import randomstring from 'randomstring';
import simpleOauth2 from 'simple-oauth2';

export default ({
    url,
    clientId,
    clientSecret,
    oauthOptions = {}
}) => {
    // Initialize OAuth
    const oauth2 = simpleOauth2.create({
        ...oauthOptions,
        client: {
            id: config.clientId,
            secret: config.clientSecret,
            ...oauthOptions.client
        },
        auth: {
            tokenHost: config.url,
            ...oauthOptions.auth
        }
    });

    const login = async () => {
        try {
            // Generate state
            const state = randomstring.generate(32);
            ctx.session.state = state;

            if (ctx.query.redirect) {
                ctx.session.redirect = ctx.query.redirect;
            } else {
                ctx.session.redirect = config.redirectUrl;
            }

            // Redirect to VCK OAuth
            const url = oauth2.authorizationCode.authorizeURL({
                redirect_uri: `${config.mainUrl}/auth/authorized`,
                scope: 'read',
                state: state
            });
            ctx.redirect(url);
        } catch (err) {
            log.error(err);
            return ctx.redirect(`${config.errorUrl}?error=unknown`);
        }
    };

    const authorized = async (ctx) => {
        try {
            if (!ctx.query.code || !ctx.query.state || ctx.query.state !== ctx.session.state) {
                return ctx.redirect(`${config.errorUrl}?error=invalid_code_or_state`);
            }

            // Request access token
            const result = await oauth2.authorizationCode.getToken({
                redirect_uri: `${config.mainUrl}/auth/authorized`,
                code: ctx.query.code
            });
            const accessToken = oauth2.accessToken.create(result);

            // Fetch user details
            const response = await fetch(`${config.apiUrl}?access_token=${accessToken.token.access_token}`);
            const data = await response.json();
            if (response.ok) {
                // Check if the user is an active VCK member, i.e. has access to this application
                if (data.user.groups.indexOf('active') === -1) {
                    return ctx.redirect(`${config.errorUrl}?error=user_not_admin`);
                }

                // Login was successful, redirect to the original URL
                ctx.session.user = data.user;
                ctx.session.token = accessToken.token;
                return ctx.redirect(ctx.session.redirect);
            } else {
                // Login failed, redirect to the error page
                log.error(`Failed to fetch user: ${response.status} ${response.statusText} - ${data.error}`);
                return ctx.redirect(`${config.errorUrl}?error=user_fetch_failed`);
            }
        } catch (err) {
            log.error(err);
            return ctx.redirect(`${config.errorUrl}?error=unknown`);
        }
    };

    const whoami = async (ctx) => {
        try {
            // Check if the user is logged in and the token is still valid
            if (ctx.session.token && new Date() < new Date(ctx.session.token.expires_at) && ctx.session.user) {
                ctx.success(ctx.session.user);
            } else {
                ctx.error(401, 'Not logged in');
            }
        } catch (err) {
            onError(ctx, 500, 'An unexpected error occurred', err);
        }
    };

    const logout = async (ctx) => {
        try {
            // Delete stored access token and user details
            ctx.session.token = null;
            ctx.session.user = null;
            ctx.success(null, 204);
        } catch (err) {
            onError(ctx, 500, 'An unexpected error occurred', err);
        }
    };

    return {
        login,
        authorized,
        whoami,
        logout
    };
};
