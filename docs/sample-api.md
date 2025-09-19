# sample-api.ts

## Overview

This file contains 10 functions.

## Table of Contents

### Functions
- [getUsersFromDatabase](#getusersfromdatabase)
- [getUserById](#getuserbyid)
- [createUser](#createuser)
- [updateUser](#updateuser)
- [deleteUser](#deleteuser)
- [getUserProfile](#getuserprofile)
- [uploadAvatar](#uploadavatar)
- [getUserPosts](#getuserposts)
- [createPost](#createpost)
- [getPostComments](#getpostcomments)

### API Endpoints
- [GET /api/users](#get--api-users)
- [GET /api/users/:id](#get--api-users--id)
- [POST /api/users](#post--api-users)
- [PUT /api/users/:id](#put--api-users--id)
- [DELETE /api/users/:id](#delete--api-users--id)
- [GET /profile](#get--profile)
- [POST /profile/avatar](#post--profile-avatar)
- [GET /api/users/:userId/posts](#get--api-users--user-d-posts)
- [POST /api/users/:userId/posts](#post--api-users--user-d-posts)
- [GET /api/posts/:postId/comments](#get--api-posts--post-d-comments)
- [GET /health](#get--health)

## Functions

### getUsersFromDatabase

```typescript
async function getUsersFromDatabase(limit: number, offset: number): Promise<any[]>
```

**Parameters:**

- **limit** `number`
- **offset** `number`

**Returns:**

`Promise<any[]>`


### getUserById

```typescript
async function getUserById(id: string): Promise<any>
```

**Parameters:**

- **id** `string`

**Returns:**

`Promise<any>`


### createUser

```typescript
async function createUser(userData: any): Promise<any>
```

**Parameters:**

- **userData** `any`

**Returns:**

`Promise<any>`


### updateUser

```typescript
async function updateUser(id: string, updateData: any): Promise<any>
```

**Parameters:**

- **id** `string`
- **updateData** `any`

**Returns:**

`Promise<any>`


### deleteUser

```typescript
async function deleteUser(id: string): Promise<boolean>
```

**Parameters:**

- **id** `string`

**Returns:**

`Promise<boolean>`


### getUserProfile

```typescript
async function getUserProfile(userId: string): Promise<any>
```

**Parameters:**

- **userId** `string`

**Returns:**

`Promise<any>`


### uploadAvatar

```typescript
async function uploadAvatar(userId: string, file: any): Promise<string>
```

**Parameters:**

- **userId** `string`
- **file** `any`

**Returns:**

`Promise<string>`


### getUserPosts

```typescript
async function getUserPosts(userId: string, page: number, limit: number): Promise<any[]>
```

**Parameters:**

- **userId** `string`
- **page** `number`
- **limit** `number`

**Returns:**

`Promise<any[]>`


### createPost

```typescript
async function createPost(userId: string, postData: any): Promise<any>
```

**Parameters:**

- **userId** `string`
- **postData** `any`

**Returns:**

`Promise<any>`


### getPostComments

```typescript
async function getPostComments(postId: string): Promise<any[]>
```

**Parameters:**

- **postId** `string`

**Returns:**

`Promise<any[]>`


## Dependencies

This file imports from the following modules:

- **express** (default): express
- **express** (named): Request, Response, NextFunction

## API Endpoints

### GET /api/users

**Handler:** `anonymous`

**Example:**

```http
GET /api/users
```


### GET /api/users/:id

**Handler:** `anonymous`

**Parameters:**

- **id** `string` - Path parameter from /api/users/:id

**Example:**

```http
GET /api/users/:id
```


### POST /api/users

**Handler:** `authenticate`

**Example:**

```http
POST /api/users
```


### PUT /api/users/:id

**Handler:** `authenticate`

**Parameters:**

- **id** `string` - Path parameter from /api/users/:id

**Example:**

```http
PUT /api/users/:id
```


### DELETE /api/users/:id

**Handler:** `authenticate`

**Parameters:**

- **id** `string` - Path parameter from /api/users/:id

**Example:**

```http
DELETE /api/users/:id
```


### GET /profile

**Handler:** `authenticate`

**Example:**

```http
GET /profile
```


### POST /profile/avatar

**Handler:** `authenticate`

**Example:**

```http
POST /profile/avatar
```


### GET /api/users/:userId/posts

**Handler:** `anonymous`

**Parameters:**

- **userId** `string` - Path parameter from /api/users/:userId/posts

**Example:**

```http
GET /api/users/:userId/posts
```


### POST /api/users/:userId/posts

**Handler:** `authenticate`

**Parameters:**

- **userId** `string` - Path parameter from /api/users/:userId/posts

**Example:**

```http
POST /api/users/:userId/posts
```


### GET /api/posts/:postId/comments

**Handler:** `anonymous`

**Parameters:**

- **postId** `string` - Path parameter from /api/posts/:postId/comments

**Example:**

```http
GET /api/posts/:postId/comments
```


### GET /health

**Handler:** `anonymous`

**Example:**

```http
GET /health
```

