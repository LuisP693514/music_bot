//imports

const { Client, GatewayIntentBits } = require('discord.js');
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');
const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
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

    if (message.content.startsWith(`${prefix}play `) || message.content.startsWith(`${prefix}p `)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`) || message.content.startsWith(`${prefix}s`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}clear`) || message.content.startsWith(`${prefix}c`)) {
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

    const youtubeRegex = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts)\/|www\.youtube\.com\/watch\?v=)/;
    
    if (args[1].match(youtubeRegex)) {
        const songInfo = await ytdl.getInfo(args[1]);
        const song = {
            title: songInfo.player_response.videoDetails.title,
            videoId: songInfo.player_response.videoDetails.videoId,
        };

        if (!serverQueue) {

            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true,
                player: null,
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
    } else {
        return message.channel.send(`I can only read youtube links (._.\`)`);
    }

    
}

const play = (guild, song) => {

    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    let stream;

    try {
        stream = ytdl(`https://www.youtube.com/watch?v=${song.videoId}`, {
            filter: "audioonly"
        });
    } catch (error) {
        console.log(error);
    }

    const player = createAudioPlayer();
    const resource = createAudioResource(stream, { inlineVolume: true });
    resource.volume.setVolume(serverQueue.volume / 5);

    serverQueue.player = player;

    const musicPlay = async () => {
        player.play(resource)
        serverQueue.connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0])
        })
            .on('error', error => console.log(error));
    }

    musicPlay();
    serverQueue.textChannel.send(`🎵 Started playing: **${song.title}** 🎵`);
}

const skip = async (message, serverQueue) => {
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in the vc to skip");
    }

    if (!serverQueue) {
        return message.channel.send("Can't skip nothing");
    }

    serverQueue.songs.shift();
    play(message.guild, serverQueue.songs[0])
}

// clear the queue
const stop = async (message, serverQueue) => {
    if (!message.member.voice.channel) {
        return message.channel.send("You have to be in the vc to stop the music 😡")
    }

    if (serverQueue) {
        serverQueue.songs = [];
        serverQueue.connection.destroy();
    }
}

client.login(token);
