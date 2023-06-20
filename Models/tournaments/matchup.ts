import { BaseEntity, Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../user";
import { Mappool } from "./mappools/mappool";
import { MatchupMap } from "./matchupMap";
import { Round } from "./round";
import { Stage } from "./stage";
import { Team } from "./team";

@Entity()
export class Matchup extends BaseEntity {

    @PrimaryGeneratedColumn()
        ID!: number;

    @Column({ type: "int", nullable: true })
        mp?: number | null;

    @ManyToOne(() => Round, round => round.matchups)
        round?: Round | null;

    @ManyToOne(() => Stage, stage => stage.matchups)
        stage?: Stage | null;

    @Column({ type: "boolean", default: false })
        isLowerBracket!: boolean;

    @ManyToMany(() => Team, team => team.matchupGroup)
    @JoinTable()
        teams?: Team[] | null;

    @ManyToOne(() => Team, team => team.matchupsAsTeam1)
        team1?: Team | null;

    @ManyToOne(() => Team, team => team.matchupsAsTeam2)
        team2?: Team | null;

    @Column({ type: "int", default: 0 })
        team1Score!: number;

    @Column({ type: "int", default: 0 })
        team2Score!: number;

    @ManyToOne(() => Team, team => team.matchupsFirst)
        first?: Team | null;

    @ManyToOne(() => Team, team => team.wins)
        winner?: Team | null;

    @ManyToOne(() => MatchupMap, map => map.matchups)
        maps!: MatchupMap[];

    @ManyToMany(() => Mappool, mappool => mappool.bannedInMatchups)
    @JoinTable()
        mappoolsBanned?: Mappool[] | null;

    @Column({ type: "boolean", default: false })
        potential!: boolean;

    @Column({ type: "boolean", default: false })
        forfeit!: boolean;

    @Column({ type: "varchar", nullable: true })
        vod?: string | null;

    @Column("datetime")
        date!: Date;

    @ManyToOne(() => User, user => user.matchupsRefereed)
        referee?: User | null;

    @ManyToMany(() => User, user => user.matchupsCommentated)
    @JoinTable()
        commentators?: User[] | null;

    @ManyToOne(() => User, user => user.matchupsStreamed)
        streamer?: User | null;

    @ManyToMany(() => Matchup, matchup => matchup.nextMatchups)
    @JoinTable()
        previousMatchups?: Matchup[] | null;

    @ManyToMany(() => Matchup, matchup => matchup.previousMatchups)
        nextMatchups?: Matchup[] | null;

    @Column("mediumtext", { nullable: true })
        log?: string | null;

    constructor (parents?: Matchup[]) {
        super();
        this.nextMatchups = parents;
    }
}