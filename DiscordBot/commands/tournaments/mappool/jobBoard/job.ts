import { ChatInputCommandInteraction, Message, SlashCommandBuilder, ThreadChannel } from "discord.js";
import { Command } from "../../../index";
import { fetchJobChannel, fetchMappool, fetchSlot, fetchTournament, hasTournamentRoles, isSecuredChannel } from "../../../../functions/tournamentFunctions";
import { TournamentChannelType } from "../../../../../Models/tournaments/tournamentChannel";
import { TournamentRoleType } from "../../../../../Models/tournaments/tournamentRole";
import { User } from "../../../../../Models/user";
import { loginResponse } from "../../../../functions/loginResponse";
import { JobPost } from "../../../../../Models/tournaments/mappools/jobPost";
import { discordClient } from "../../../../../Server/discord";

async function run (m: Message | ChatInputCommandInteraction) {
    if (!m.guild)
        return;

    if (m instanceof ChatInputCommandInteraction)
        await m.deferReply();

    const securedChannel = await isSecuredChannel(m, [TournamentChannelType.Admin]);
    if (!securedChannel) 
        return;

    const tournament = await fetchTournament(m);
    if (!tournament) 
        return;

    const allowed = await hasTournamentRoles(m, tournament, [TournamentRoleType.Organizer, TournamentRoleType.Mappoolers]);
    if (!allowed) 
        return;

    const forumChannel = await fetchJobChannel(m, tournament);
    if (!forumChannel)
        return;
    
    const poolRegex = /-p (\S+)/;
    const slotRegex = /-s (\S+)/;
    const poolText = m instanceof Message ? m.content.match(poolRegex) ?? m.content.split(" ")[1] : m.options.getString("pool");
    const slotText = m instanceof Message ? m.content.match(slotRegex) ?? m.content.split(" ")[2] : m.options.getString("slot");
    if (!poolText || !slotText) {
        if (m instanceof Message) m.reply("Missing parameters. Please use `-p <pool> -s <slot> <description>` or `<pool> <slot> <description>`. If you do not use the `-` prefixes, the order of the parameters is important.");
        else m.editReply("Missing parameters. Please use `/job <pool> <slot> <description>`.");
        return;
    }

    const remainingText = m instanceof Message ? m.content.replace(poolRegex, "").replace(slotRegex, "").split(" ").slice(3).join(" ") : m.options.getString("description");
    if (!remainingText || remainingText === "") {
        if (m instanceof Message) m.reply("Missing parameters. Please use `-p <pool> -s <slot> <description>` or `<pool> <slot> <description>`. If you do not use the `-` prefixes, the order of the parameters is important.");
        else m.editReply("Missing parameters. Please use `/job <pool> <slot> <description>`.");
        return;
    }
    if (remainingText.length > 1024) {
        if (m instanceof Message) m.reply("Description is too long. Please keep it under 1024 characters.");
        else m.editReply("Description is too long. Please keep it under 1024 characters.");
        return;
    }

    const pool = typeof poolText === "string" ? poolText : poolText[1];
    const order = parseInt(typeof slotText === "string" ? slotText.substring(slotText.length - 1) : slotText[1].substring(slotText[1].length - 1));
    const slot = (typeof slotText === "string" ? slotText.substring(0, slotText.length - 1) : slotText[1].substring(0, slotText[1].length - 1)).toUpperCase();
    if (isNaN(order)) {
        if (m instanceof Message) m.reply(`Invalid slot number **${order}**. Please use a valid slot number.`);
        else m.editReply(`Invalid slot number **${order}**. Please use a valid slot number.`);
        return;
    }

    const mappool = await fetchMappool(m, tournament, pool);
    if (!mappool) 
        return;
    const mappoolSlot = `${mappool.abbreviation.toUpperCase()} ${slot}${order}`;

    const slotMod = await fetchSlot(m, mappool, slot, true);
    if (!slotMod) 
        return;

    const mappoolMap = slotMod.maps.find(m => m.order === order);
    if (!mappoolMap) {
        if (m instanceof Message) m.reply(`Could not find **${mappoolSlot}**`);
        else m.editReply(`Could not find **${mappoolSlot}**`);
        return;
    }
    if ((mappoolMap.customMappers && mappoolMap.customMappers.length > 0) || mappoolMap.beatmap) {
        if (m instanceof Message) m.reply(`**${mappoolSlot}** has already been assigned. There is no reason to create a job board post.`);
        else m.editReply(`**${mappoolSlot}** has already been assigned. There is no reason to create a job board post.`);
        return;
    }

    const user = await User.findOne({
        where: {
            discord: {
                userID: m instanceof Message ? m.author.id : m.user.id,
            },
        },
    })
    if (!user) {
        await loginResponse(m);
        return;
    }

    if (!mappoolMap.jobPost)
        mappoolMap.jobPost = new JobPost();

    mappoolMap.jobPost.description = remainingText;
    mappoolMap.jobPost.createdBy = user;

    if (mappoolMap.jobPost.jobBoardThread) {
        const ch = await discordClient.channels.fetch(mappoolMap.jobPost.jobBoardThread);
        if (!ch || !(ch instanceof ThreadChannel)) {
            if (m instanceof Message) m.reply(`Could not find thread for **${slot}** which should be <#${mappoolMap.customThreadID}> (ID: ${mappoolMap.customThreadID})`);
            else m.editReply(`Could not find thread for **${slot}** which should be <#${mappoolMap.customThreadID}> (ID: ${mappoolMap.customThreadID})`);
            return;
        }
        const msg = await ch.fetchStarterMessage()
        if (!msg) {
            if (m instanceof Message) m.reply(`Could not find starter message for **${slot}** which should be <#${mappoolMap.customThreadID}> (ID: ${mappoolMap.customThreadID})`);
            else m.editReply(`Could not find starter message for **${slot}** which should be <#${mappoolMap.customThreadID}> (ID: ${mappoolMap.customThreadID})`);
            return;
        }

        await msg.edit(`**${mappoolSlot}**\n${remainingText}`);
    }

    await mappoolMap.jobPost.save();
    await mappoolMap.save();

    if (m instanceof Message) m.reply(`Successfully created/edited job post for **${mappoolSlot}**:\n${remainingText}`);
    else m.editReply(`Successfully created/edited job post for **${mappoolSlot}**:\n${remainingText}`);
}

const data = new SlashCommandBuilder()
    .setName("job")
    .setDescription("Create/edit a job board post for a mappool slot.")
    .addStringOption(option =>
        option.setName("pool")
            .setDescription("The mappool to create/edit a job board post for.")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("slot")
            .setDescription("The slot to create/edit a job board post for.")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("description")
            .setDescription("The description for the job post.")
            .setMaxLength(1024)
            .setRequired(true))
    .setDMPermission(false);

const job: Command = {
    data,
    alternativeNames: [ "job_mappool", "mappool-job", "job-mappool", "mappooljob", "jobmappool", "jobp", "pjob", "pool_job", "job_pool", "pool-job", "job-pool", "pooljob", "jobpool", "mappool_j", "j_mappool", "mappool-j", "j-mappool", "mappoolj", "jmappool", "jp", "pj", "pool_j", "j_pool", "pool-j", "j-pool", "poolj", "jpool", "job_add", "add_job", "job-add", "add-job", "jobadd", "addjob", "addj", "jadd", "job_a", "a_job", "job-a", "a-job", "joba", "ajob", "aj", "ja", "job", "j", "job_edit", "edit_job", "job-edit", "edit-job", "jobedit", "editjob", "editj", "jedit", "job_e", "e_job", "job-e", "e-job", "jobe", "ejob", "ej", "je", "job", "j" ],
    category: "tournaments",
    subCategory: "mappools/jobs",
    run,
};

export default job;