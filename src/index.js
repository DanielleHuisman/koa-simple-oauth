import createMiddleware from './middleware';

const defaultConfig = {
    onSuccess: (ctx, status = 200, data = null) => {
        ctx.status = status;
        ctx.body = typeof data === 'object' ? JSON.stringify(data) : data;
    },
    onError: (ctx, status, message) => {
        ctx.status = status;
        ctx.body = message;
    }
};

export default ({
    routes: {
        login = '/login',
        authorized = '/authorized',
        whoami = '/whoami',
        logout = '/logout'
    } = {},
    ...config
}, router) => {
    // Create middleware
    const middleware = createMiddleware(Object.assign({}, defaultConfig, config));

    // Return the raw middleware if no router is present
    if (!router) {
        return middleware;
    }

    // Register middleware and return any results
    return {
        login: router.get(login, middleware.login),
        authorized: router.get(authorized, middleware.authorized),
        whoami: router.get(whoami, middleware.whoami),
        logout: router.get(logout, middleware.logout),
        isLoggedIn: middleware.isLoggedIn,
        requireLogin: middleware.requireLogin
    };
};
