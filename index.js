//imports

const { Client, GatewayIntentBits } = require('discord.js');
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');

// create client and login

const client = new Client(
    {
        intents:
            [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates
            ]
    }
);

// create the queue

const queue = new Map();



// listeners
client.once('ready', () => {
    console.log('Ready!');
});

client.once('reconnecting', () => {
    console.log('Reconnecting...');
});

client.once('disconnect', () => {
    console.log('Disconnect');
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else {
        message.channel.send("You need to enter a valid command")
    }
});

const execute = async (message, serverQueue) => {

    const args = message.content.split(" ")

    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
        return message.channel.send("You better join a voice channel or else I won't work :(");
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send("I can't join the vc because of permissions (CONNECT, SPEAK)")
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.title,
        url: songInfo.video_url,
    };

    if (!serverQueue) {

        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };

        queue.set(message.guild.id, queueConstruct);
        queueConstruct.songs.push(song);

        try {
            //joining vc and hopefully it works

            const connection = await voiceChannel.join();
            queueConstruct.connection = connection;

            play(message.guild, queueConstruct.songs[0]);

        } catch (error) {

            console.log(error);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }

    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue 😚`);
    }
}

const play = (guild, song) => {

    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0])
        })
        .on("error", (error) => {
            console.log(error);
        });

    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Started playing: **${song.title}**`);
}

const skip = async (message, serverQueue) => {
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in the vc to skip");
    }

    if (!serverQueue) {
        return message.channel.send("Can't skip nothing");
    }
    serverQueue.connection.dispatcher.end();
}

const stop = async (message, serverQueue) => {
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in the vc to stop the music 😡")
    }

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}


client.login(token);
