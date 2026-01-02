Welcome to our IoT Project
==========================

Table of Contents
=================

 - [Overview](#overview)
 - [Download](#download)

Overview
========

Our product is a remote controlled car via web browser. 

Wifi is compulsory to control the car and the range is not limited, you can still "communicate" with your car even in different network.

Download
========

The source code can be cloned from this Github repository.
```bash
git clone https://github.com/minhi1/remote-controlled-car.git
```

Then, in the directory that contains `package.json` file, run this command to install required packages.
```bash
npm install
```

Create own database that obeys the following format.
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(25) NOT NULL UNIQUE,
    password VARCHAR NOT NULL UNIQUE,
    email VARCHAR NOT NULL UNIQUE
);

ALTER TABLE users 
ADD CONSTRAINT chk_valid_email
CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

ALTER TABLE users
ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE TABLE img_storage (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    url VARCHAR NOT NULL UNIQUE
);
```

Prepare the `.env` file with own database information and secret key. For example.
```env
DB_Host = {server_host}
DB_Port = {server_port}
DB_Username = {username}
DB_Password = {password}
DB_Database = {database_name}
SECRET_KEY = {secret_key}
PORT = {app_port}
```

Run the localhost server.
```bash
npm run dev
```