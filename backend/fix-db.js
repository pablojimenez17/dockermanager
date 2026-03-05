import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/dockermanager')
    .then(async () => {
        const db = mongoose.connection.db;
        try {
            await db.collection('users').drop();
            console.log('Users collection dropped successfully');
        } catch (e) {
            console.log('Error dropping or collection doesnt exist', e.message);
        }
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
