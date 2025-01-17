import { ChatInputCommandInteraction, Message, SlashCommandBuilder } from "discord.js";
import { In, MoreThan } from "typeorm";
import { Command } from "..";
import { Tournament, TournamentStatus } from "../../../Models/tournaments/tournament";
import respond from "../../functions/respond";
import { extractParameters } from "../../functions/parameterFunctions";
import { discordStringTimestamp } from "../../../Server/utils/dateParse";

async function run (m: Message | ChatInputCommandInteraction) {
    if (m instanceof ChatInputCommandInteraction)
        await m.deferReply();

    const params = extractParameters<parameters>(m, [
        { name: "server", shortName: "s", optional: true, paramType: "boolean" },
        { name: "past_registration", shortName: "pr", optional: true, paramType: "boolean" },
        { name: "finished", shortName: "f", optional: true, paramType: "boolean" },
        { name: "mode", optional: true, paramType: "string" },
    ]);
    if (!params)
        return;

    const { server, past_registration, finished, mode } = params;

    if (server && !m.guild) {
        await respond(m, "U can only use this option in a server dude");
        return;
    }

    if (mode && !["osu", "taiko", "catch", "mania"].includes(mode)) {
        await respond(m, "Invalid mode");
        return;
    }

    const modeID = mode ? ["osu", "taiko", "catch", "mania"].indexOf(mode) + 1 : 0;

    const findOptions = {
        ...(server ? { server: m.guild!.id } : { }),
        ...(mode ? { mode: { ID: modeID } } : { }),
        ...(past_registration ? { } : { registrations: { end: MoreThan(new Date()) } }),
        ...(finished ? { } : { status: In([TournamentStatus.NotStarted, TournamentStatus.Registrations, TournamentStatus.Ongoing]) }),
    };

    const tournaments = await Tournament.find({
        where: findOptions,
        relations: ["mode"],
    });

    if (tournaments.length === 0) {
        await respond(m, "No tournaments found");
        return;
    }

    const embed = {
        title: "Tournaments",
        description: tournaments.map(t => {
            return `**${t.name}** - ${t.mode.name} - ${discordStringTimestamp(t.registrations.start)} → ${discordStringTimestamp(t.registrations.end)}`;
        }).join("\n"),
    };

    await respond(m, undefined, [embed]);
}

const data = new SlashCommandBuilder()
    .setName("list_tournaments")
    .setDescription("Lists currently running tournaments")
    .addBooleanOption(option => 
        option.setName("past_registration")
            .setDescription("List tournaments past registration date")
            .setRequired(false)
    )
    .addBooleanOption(option => 
        option.setName("finished")
            .setDescription("List tournaments that are finished")
            .setRequired(false)
    )
    .addBooleanOption(option => 
        option.setName("server")
            .setDescription("List tournaments in current server only")
            .setRequired(false)
    )
    .addStringOption(option =>
        option.setName("mode")
            .setDescription("Filter by mode")
            .setRequired(false)
            .addChoices(
                {
                    name: "osu!standard",
                    value: "osu",
                },
                {
                    name: "osu!taiko",
                    value: "taiko",
                },
                {
                    name: "osu!catch",
                    value: "catch",
                },
                {
                    name: "osu!mania",
                    value: "mania",
                }
            )
    );

interface parameters {
    server?: boolean,
    past_registration?: boolean,
    finished?: boolean,
    mode?: string,
}

const tournamentList: Command = {
    data,
    alternativeNames: ["list_tournament", "tournaments_list", "tournament_list", "list-tournaments", "list-tournament", "tournaments-list", "tournament-list", "tournamentslist", "tournamentlist", "listtournaments", "listtournament", "listt", "tlist", "tournamentl", "tournamentsl", "ltournament", "ltournaments"],
    category: "tournaments",
    run,
};

export default tournamentList;