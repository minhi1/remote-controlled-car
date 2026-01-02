const { text } = require("body-parser");
const db = require("./database");
const { PreparedStatement } = require('pg-promise');
const crypto = require('crypto');

async function getUserByUsername(username) {
    const prepareGetUser = new PreparedStatement({
        name: 'prepare-get-user',
        text: 'SELECT * FROM users WHERE username = $1',
        values: [username]
    });

    var user = await db.oneOrNone(prepareGetUser);
    if (!user) return undefined; 
    return user;
}

async function getUserByEmail(email) {
    const prepareGetUserByEmail = new PreparedStatement({
        name: 'prepare-get-user-by-email',
        text: 'SELECT * FROM users WHERE email = $1',
        values: [email]
    });

    var user = await db.oneOrNone(prepareGetUserByEmail);
    if (!user) return undefined; 
    return user;
}

async function addUser(email, username, password) {
    const prepareAddUser = new PreparedStatement({
        name: 'prepare-add-user',
        text: 'INSERT INTO users(username, password, email) VALUES($1, $2, $3)',
        values: [username, password, email]
    });

    try {
        await db.none(prepareAddUser);
    } catch (error) {
        return `Cannot register: ${error}`;
    }

    return "Successfully creates a new account!!!";
}

module.exports = {
    getUserByUsername,
    getUserByEmail,
    addUser
};