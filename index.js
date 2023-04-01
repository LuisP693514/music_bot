//imports

const { Client, GatewayIntentBits } = require('discord.js');
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');
const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const sodium = require('libsodium-wrappers');

// create client and login

const client = new Client(
    {
        intents:
            [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
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

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        console.log('here')
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
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

    if (!permissions.has([PermissionsBitField.Flags.Connect]) || !permissions.has(PermissionsBitField.Flags.Speak)) {
        return message.channel.send("I can't join the vc because of permissions (CONNECT, SPEAK)")
    }
    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.player_response.videoDetails.title,
        url: `https://www.youtube.com/watch?v=${songInfo.player_response.videoDetails.videoId}`,
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

            await sodium.ready;
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                encryptionMode: sodium
            })
            queueConstruct.connection = connection;

            play(message.guild, queueConstruct.songs[0]);

        } catch (error) {

            // console.log(error);
            queue.delete(message.guild.id);
            return message.channel.send(error); 
        }

    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`**${song.title}** has been added to the queue 😚`);
    }
}

const play = (guild, song) => {

    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const stream = ytdl(song.url, {
        filter: "audioonly"
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(stream);

    const musicPlay = async () => {
        player.play(resource);  
        serverQueue.connection.subscribe(player);
    }

    musicPlay();
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
