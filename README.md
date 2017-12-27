# koa-simple-oauth

Simple OAuth2 authentication middleware for Koa. Internally uses [simple-oauth2](https://github.com/lelylan/simple-oauth2) and [Node Fetch API](https://github.com/bitinn/node-fetch).

## Requirements
- [Koa Session middleware](https://github.com/koajs/session)
- Something to mount middleware, examples:
  - [Koa Router](https://github.com/alexmingoia/koa-router) *recommended*
  - [Koa Mount](https://github.com/koajs/mount)
  - [Koa Route](https://github.com/koajs/route)

## Installation
```bash
yarn add koa-simple-oauth
```

## Usage
### Requirements
```javascript
import Koa from 'koa';
import session from 'koa-session';
import simpleOauth from 'koa-simple-oauth';

// Initialize Koa
const app = new Koa();

// Initialize Koa Session
app.keys = ['secretSessionKey'];
const sessionConfig = {};
app.use(session(sessionConfig, app));
```

### Configuration
```javascript
const oauthConfig = {
    // Client ID and secret for OAuth provier
    clientId: 'abcdefgh1234',
    clientSecret: '5678mnopqrst',

    // Base URL for OAuth provider
    url: 'https://oauth.example.com/api/v1',

    // Redirect URL for this application, i.e. where you mounted the authorized middleware
    redirectUrl: 'https://myapp.example.com/api/v1/oauth/authorized',

    // User API URL and HTTP method
    userUrl: 'https://oauth.example.com/api/v1/me',
    userMethod: 'GET',

    // Get user from API response or return an error
    user: (data) => {
        const user = data.user;
        if (!user.isAdmin) {
            return 'not_admin';
        }
        return user;
    },

    // These options are passed to simple-oauth2, see https://github.com/lelylan/simple-oauth2
    oauthOptions: {},

    // Default redirect URL on success (or set the redirect query parameter)
    redirectSuccessUrl: 'https://myapp.example.com/login/success',

    // Redirect URL on error (will add an error message as error query parameter by default, e.g. ?error=invalid_code_or_state)
    redirectErrorUrl: 'https://myapp.example.com/login/error',

    // Don't send an error query parameter to the error redirect URL (see above)
    disableErrorReason: false,

    // Called on successful API response (e.g. whoami endpoint)
    onSuccess: (ctx, data, status = 200) => {
        ctx.status = status;
        ctx.body = typeof data === 'object' ? JSON.stringify(data) : data;
    },

    // Called on error API response (e.g. whoami endpoint)
    onError: (ctx, status, message, err) => {
        ctx.status = status;
        ctx.body = `${message}: ${err.message}`;
    },

    // Called whenever on error occurs
    logError: (err) => {
        if (err.message !== 'Not logged in') {
            console.error(err);
        }
    },

    // Route configuration (only works if a router is provided)
    routes: {
        login: '/login',
        authorized: '/authorized',
        whoami: '/whoami',
        logout: '/logout'
    }
};
```

### With Koa Router (recommended)
```javascript
import Router from 'koa-router';

// Initialize Koa Router
const router = new Router();

// Initialize Koa Simple OAuth
// Adds all required middleware to the router
simpleOauth(oauthConfig, router);

// Add Koa Router middleware
app.use(router.routes());
app.use(router.allowedMethods());
```

### With Koa Mount
```javascript
import mount from 'koa-mount';

// Initialize Koa Simple OAuth
// Returns an object with all required middleware
const oauthMiddleware = simpleOauth(oauthConfig);
const {login, authorized, whoami, logout} = oauthMiddleware;

// Mount the OAuth middleware
app.use(mount('/login', login));
app.use(mount('/authorized', authorized));
app.use(mount('/whoami', whoami));
app.use(mount('/logout', logout));
```

### With Koa Route
```javascript
import _ from 'koa-route';

// Initialize Koa Simple OAuth
// Passes all required middleware through the router function and returns the resulting middleware as an object
const oauthMiddleware = simpleOauth(oauthConfig, _);

// Mount the OAuth middleware
const {login, authorized, whoami, logout} = oauthMiddleware;
app.use(login);
app.use(authorized);
app.use(whoami);
app.use(logout);

// Or mount it less explicitly
Object.values(oauthMiddleware).forEach((middleware) => {
    app.use(middleware);
});
```
