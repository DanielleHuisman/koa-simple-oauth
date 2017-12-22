import createMiddleware from './middleware';

const defaultConfig = {
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

    // Register middleware
    router.get(login, middleware.login);

    router.get(authorized, middleware.authorized);

    router.get(whoami, middleware.whoami);
    router.post(whoami, middleware.whoami);

    router.get(logout, middleware.logout);
    router.post(logout, middleware.logout);
};
