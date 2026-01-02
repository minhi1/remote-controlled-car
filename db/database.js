// Loading and initializing the library
const pgp = require('pg-promise')();
const fs = require('fs');
require('dotenv').config();

// Connection details
// postgres://username:password@host:port/database?sslmode=disable
const host = process.env.DB_Host;
const username =  process.env.DB_Username;
const password = process.env.DB_Password;
const database = process.env.DB_Database;
// console.log(host, port, username, password);
const connString = `postgres://${username}:${password}@${host}/${database}`;

const dbConfig = {
    connectionString: connString,
    max: 100, 
    idleTimeoutMillis: 30000,
    ssl: {
        rejectUnauthorized: false
    }
    // connectionTimeoutMillis: 10000,
};

// Creating a new database instance
var db;
try {
    db = pgp(dbConfig);
} catch (error) {
    console.error('Error creating database instance:', error);
}

// Exporting the database object 
module.exports = db;