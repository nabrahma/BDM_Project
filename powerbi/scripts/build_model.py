"""Generate the TMDL semantic model for IPL_Auction_Value.pbip.

All data preparation lives in the Power Query (M) code below, so a refresh in
Power BI Desktop rebuilds everything from /data/raw. This script only writes
the text files; it never touches the data.

Usage (from powerbi/):  ../.venv/Scripts/python -I scripts/build_model.py <project_dir> <data_folder>
"""
import json
import os
import shutil
import sys
import uuid

PROJECT = sys.argv[1]
DATA_FOLDER = sys.argv[2].rstrip("\\/") + "\\"
NAME = "IPL_Auction_Value"
SM = os.path.join(PROJECT, f"{NAME}.SemanticModel")
NS = uuid.UUID("6f1c2a52-3c2e-4b8e-9d0e-6a1b7e0c9a11")


def tag(*parts):
    """Stable lineage tags so rebuilding does not churn the files."""
    return str(uuid.uuid5(NS, "/".join(parts)))


def ind(text, n):
    pad = "\t" * n
    return "\n".join((pad + line) if line.strip() else "" for line in text.strip("\n").split("\n"))


# --------------------------------------------------------------------------
# Power Query: parameters, functions and staging queries (Enable load = off)
# --------------------------------------------------------------------------
PARAMS = {
    "DataFolder": (f'"{DATA_FOLDER}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]', "Text"),
    "UsdInrRate2013": ('54 meta [IsParameterQuery=true, Type="Number", IsParameterQueryRequired=true]', "Number"),
    "FirstSeason": ('2013 meta [IsParameterQuery=true, Type="Number", IsParameterQueryRequired=true]', "Number"),
    "LastSeason": ('2026 meta [IsParameterQuery=true, Type="Number", IsParameterQueryRequired=true]', "Number"),
}

FUNCTIONS = {}
FUNCTIONS["fnNormName"] = r'''
// Lower-case, letters only, collapse spaces, and join runs of initials ("K.S. Bharat" -> "ks bharat").
(name as nullable text) as nullable text =>
let
    Lower = if name = null then "" else Text.Lower(Text.Trim(name)),
    Letters = Text.Combine(List.Transform(Text.ToList(Lower), each if _ >= "a" and _ <= "z" then _ else " ")),
    Tokens = List.Select(Text.Split(Letters, " "), each _ <> ""),
    Merged = List.Accumulate(Tokens, [Out = {}, PrevInitial = false], (s, t) =>
        if Text.Length(t) = 1 and s[PrevInitial] then
            [Out = List.RemoveLastN(s[Out], 1) & {List.Last(s[Out]) & t}, PrevInitial = true]
        else
            [Out = s[Out] & {t}, PrevInitial = Text.Length(t) = 1]),
    Result = if List.IsEmpty(Merged[Out]) then null else Text.Combine(Merged[Out], " ")
in
    Result
'''
FUNCTIONS["fnInitialsKey"] = r'''
// "virat kohli" -> "v kohli", "mahendra singh dhoni" -> "ms dhoni"
(nameKey as nullable text) as nullable text =>
let
    Tokens = if nameKey = null then {} else Text.Split(nameKey, " "),
    Result =
        if List.Count(Tokens) < 2 then nameKey
        else Text.Combine(List.Transform(List.RemoveLastN(Tokens, 1), each Text.Start(_, 1))) & " " & List.Last(Tokens)
in
    Result
'''
FUNCTIONS["fnCleanText"] = r'''
(value as any) as nullable text =>
let
    s = if value = null then null else Text.Combine(List.Select(Text.Split(Text.Replace(Text.From(value), "#(00A0)", " "), " "), each _ <> ""), " ")
in
    if s = null or s = "" then null else s
'''
FUNCTIONS["fnPriceToCr"] = r'''
// Converts any price text to crores. Strips Rs, ₹, Cr, Lakh and commas first.
// defaultUnit is used when the text itself carries no unit: "rs", "usd", "lakh" or "cr".
(value as any, defaultUnit as text) as nullable number =>
let
    s = if value = null then "" else Text.Lower(Text.Trim(Text.From(value))),
    Unit =
        if Text.Contains(s, "cr") then "cr"
        else if Text.Contains(s, "lakh") or Text.Contains(s, "lac") then "lakh"
        else if Text.Contains(s, "$") or Text.Contains(s, "usd") then "usd"
        else defaultUnit,
    Digits = Text.Select(s, {"0".."9", "."}),
    n = if Digits = "" then null else Number.FromText(Digits, "en-US"),
    Cr =
        if n = null then null
        else if Unit = "cr" then n
        else if Unit = "lakh" then n / 100
        else if Unit = "usd" then n * UsdInrRate2013 / 10000000
        else n / 10000000
in
    Cr
'''
FUNCTIONS["fnStdRole"] = r'''
(role as nullable text) as nullable text =>
let
    s = if role = null then null else Text.Upper(Text.Remove(role, {" ", "-", "_"}))
in
    if s = null then null
    else if s = "BATSMAN" or s = "BATTER" then "Batter"
    else if s = "WICKETKEEPER" or s = "WK" or s = "KEEPER" then "Wicket-Keeper"
    else if s = "ALLROUNDER" then "All-Rounder"
    else if s = "BOWLER" then "Bowler"
    else null
'''
FUNCTIONS["fnStdNationality"] = r'''
(value as nullable text) as nullable text =>
let
    s = if value = null then null else Text.Upper(Text.Trim(value))
in
    if s = null or s = "" then null
    else if s = "INDIAN" or s = "INDIA" then "Indian"
    else "Overseas"
'''
FUNCTIONS["fnTeamKey"] = r'''
// Maps any raw franchise name to its TeamKey via team_map.csv (null if unmapped).
(rawName as nullable text) as nullable text =>
    if rawName = null then null else Record.FieldOrDefault(stg_TeamLookup, Text.Trim(rawName), null)
'''
FUNCTIONS["fnReadCsv"] = r'''
(relativePath as text) as table =>
let
    Source = Csv.Document(File.Contents(DataFolder & relativePath), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    CleanNames = Table.TransformColumnNames(Promoted, each Text.Trim(Text.Replace(_, Character.FromNumber(65279), "")))
in
    CleanNames
'''
FUNCTIONS["fnStandardiseAuctionFile"] = r'''
// One rename function for every yearly auction file. It reads the headers each
// year uses and maps them to Player, Team, Role, Nationality, BasePriceCr,
// PriceCr, Capped, Status.
(t as table) as table =>
let
    Clean = Table.TransformColumnNames(t, Text.Trim),
    Cols = Table.ColumnNames(Clean),
    PriceCol =
        if List.Contains(Cols, "Winning Bid in Rs") then "Winning Bid in Rs"
        else if List.Contains(Cols, "Price in $") then "Price in $"
        else "Price in rs",
    PriceUnit = if PriceCol = "Price in $" then "usd" else "rs",
    HasBase = List.Contains(Cols, "BasePrices in Rs"),
    Std = List.Transform(Table.ToRecords(Clean), (r) => [
        Player = fnCleanText(Record.Field(r, "Name")),
        Team = fnCleanText(Record.Field(r, "TeamName")),
        Role = fnCleanText(Record.FieldOrDefault(r, "Role", null)),
        Nationality = fnCleanText(Record.FieldOrDefault(r, "Nationality", null)),
        BasePriceCr = if HasBase then fnPriceToCr(Record.Field(r, "BasePrices in Rs"), "rs") else null,
        PriceCr = fnPriceToCr(Record.Field(r, PriceCol), PriceUnit),
        Capped = fnCleanText(Record.FieldOrDefault(r, "Capped/UnCapped", null)),
        Status = "Sold"
    ]),
    Out = Table.FromRecords(Std, type table [Player = text, Team = text, Role = text, Nationality = text, BasePriceCr = number, PriceCr = number, Capped = text, Status = text])
in
    Out
'''
FUNCTIONS["fnParseMatch"] = r'''
// Parses one Cricsheet match JSON into a record of match info plus three
// nested tables: Appearances (playing XI), Deliveries (one row per ball) and
// Dismissals (fielding credits). Super overs are excluded.
(doc as record, matchId as number) as record =>
let
    Info = doc[info],
    Teams = Info[teams],
    Registry = Info[registry][people],
    IdOf = (n as text) as text => Record.FieldOrDefault(Registry, n, "UNREG:" & n),
    MatchDate = Date.FromText(Info[dates]{0}, [Format = "yyyy-MM-dd", Culture = "en-US"]),
    Outcome = Record.FieldOrDefault(Info, "outcome", []),
    Winner = if Record.HasFields(Outcome, "winner") then Outcome[winner] else Record.FieldOrDefault(Outcome, "eliminator", null),
    NonBowlerKinds = {"run out", "retired hurt", "retired out", "obstructing the field", "retired not out"},
    TeamPlayers = Record.ToTable(Info[players]),
    Appearances = Table.FromRows(
        List.Combine(List.Transform(Table.ToRecords(TeamPlayers), (tp) =>
            List.Transform(tp[Value], (p) => {matchId, tp[Name], p, IdOf(p)}))),
        type table [MatchID = Int64.Type, TeamName = text, PlayerName = text, PlayerID = text]),
    Innings = List.Select(Record.FieldOrDefault(doc, "innings", {}), each not Record.FieldOrDefault(_, "super_over", false)),
    BowlingTeamOf = (bat as text) as text => if Teams{0} = bat then Teams{1} else Teams{0},
    DeliveryRows = List.Combine(List.Transform(Innings, (inn) =>
        let
            Bat = inn[team],
            Bowl = BowlingTeamOf(Bat)
        in
            List.Combine(List.Transform(Record.FieldOrDefault(inn, "overs", {}), (ov) =>
                List.Transform(ov[deliveries], (d) =>
                    let
                        Ex = Record.FieldOrDefault(d, "extras", []),
                        R = d[runs],
                        Wk = Record.FieldOrDefault(d, "wickets", {}),
                        NonBoundary = Record.FieldOrDefault(R, "non_boundary", false),
                        BatterRuns = R[batter]
                    in
                        {matchId, Bat, Bowl, IdOf(d[batter]), IdOf(d[bowler]), BatterRuns,
                         Record.FieldOrDefault(Ex, "wides", 0), Record.FieldOrDefault(Ex, "noballs", 0),
                         Record.FieldOrDefault(Ex, "byes", 0), Record.FieldOrDefault(Ex, "legbyes", 0), R[total],
                         if BatterRuns = 4 and not NonBoundary then 1 else 0,
                         if BatterRuns = 6 and not NonBoundary then 1 else 0,
                         List.Count(List.Select(Wk, (w) => not List.Contains(NonBowlerKinds, w[kind]))),
                         if List.AnyTrue(List.Transform(Wk, (w) => w[player_out] = d[batter])) then 1 else 0})))
        )),
    Deliveries = Table.FromRows(DeliveryRows,
        type table [MatchID = Int64.Type, BattingTeam = text, BowlingTeam = text, BatterID = text, BowlerID = text,
            BatterRuns = Int64.Type, Wides = Int64.Type, NoBalls = Int64.Type, Byes = Int64.Type, LegByes = Int64.Type,
            TotalRuns = Int64.Type, IsFour = Int64.Type, IsSix = Int64.Type, BowlerWickets = Int64.Type, BatterOut = Int64.Type]),
    DismissalRows = List.Combine(List.Transform(Innings, (inn) =>
        let
            Bowl = BowlingTeamOf(inn[team])
        in
            List.Combine(List.Transform(Record.FieldOrDefault(inn, "overs", {}), (ov) =>
                List.Combine(List.Transform(ov[deliveries], (d) =>
                    List.Combine(List.Transform(Record.FieldOrDefault(d, "wickets", {}), (w) =>
                        let
                            Kind = w[kind],
                            Fielders = List.Select(
                                List.Transform(Record.FieldOrDefault(w, "fielders", {}), each Record.FieldOrDefault(_, "name", null)),
                                each _ <> null)
                        in
                            if Kind = "caught" and not List.IsEmpty(Fielders) then {{matchId, Bowl, IdOf(Fielders{0}), "Catch"}}
                            else if Kind = "caught and bowled" then {{matchId, Bowl, IdOf(d[bowler]), "Catch"}}
                            else if Kind = "stumped" and not List.IsEmpty(Fielders) then {{matchId, Bowl, IdOf(Fielders{0}), "Stumping"}}
                            else if Kind = "run out" then List.Transform(Fielders, (f) => {matchId, Bowl, IdOf(f), "RunOut"})
                            else {}))))))
        )),
    Dismissals = Table.FromRows(DismissalRows, type table [MatchID = Int64.Type, FieldingTeam = text, FielderID = text, Kind = text])
in
    [
        MatchID = matchId,
        Season = Date.Year(MatchDate),
        MatchDate = MatchDate,
        Venue = Record.FieldOrDefault(Info, "venue", null),
        Team1 = Teams{0},
        Team2 = Teams{1},
        Winner = Winner,
        NoResult = if Winner = null then 1 else 0,
        Appearances = Appearances,
        Deliveries = Deliveries,
        Dismissals = Dismissals
    ]
'''

STAGING = {}
STAGING["stg_TeamMap"] = r'''
let
    Source = fnReadCsv("mappings\team_map.csv"),
    Typed = Table.TransformColumns(Source, {
        {"RawName", Text.Trim, type text}, {"TeamKey", Text.Trim, type text}, {"TeamName", Text.Trim, type text},
        {"TeamColour", Text.Trim, type text}, {"IsActive", each Text.Upper(Text.Trim(_)) = "TRUE", type logical}})
in
    Typed
'''
STAGING["stg_TeamLookup"] = r'''
let
    Lookup = Record.FromList(stg_TeamMap[TeamKey], stg_TeamMap[RawName])
in
    Lookup
'''
STAGING["stg_AuctionOrigin"] = r'''
// Backup auction dataset (2013-2022): fills Role and Indian/Overseas for years whose files lack them.
let
    Source = fnReadCsv("supplementary\auction_origin_2013_2022.csv"),
    Rows = Table.SelectRows(Source, each fnCleanText([Player]) <> null and fnCleanText([Year]) <> null),
    Shaped = Table.FromRecords(List.Transform(Table.ToRecords(Rows), (r) => [
        NameKey = fnNormName(r[Player]),
        Season = Number.RoundDown(Number.FromText(r[Year], "en-US")),
        Role = fnStdRole(r[Role]),
        Nationality = fnStdNationality(r[Player Origin])
    ]), type table [NameKey = text, Season = Int64.Type, Role = text, Nationality = text]),
    Distinct = Table.Distinct(Shaped, {"NameKey", "Season"})
in
    Distinct
'''
STAGING["stg_AuctionList2025"] = r'''
// Official TATA IPL 2025 auction list: fills Role and nationality for 2025 buys.
let
    Source = Csv.Document(File.Contents(DataFolder & "supplementary\auction_list_2025.csv"), [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    PlayerRows = Table.SelectRows(Source, each (try Number.FromText([Column1], "en-US") otherwise null) <> null),
    Shaped = Table.FromRecords(List.Transform(Table.ToRecords(PlayerRows), (r) => [
        NameKey = fnNormName(Text.Trim(r[Column4]) & " " & Text.Trim(r[Column5])),
        Role = fnStdRole(r[Column10]),
        Nationality = fnStdNationality(r[Column6])
    ]), type table [NameKey = text, Role = text, Nationality = text]),
    Distinct = Table.Distinct(Shaped, {"NameKey"})
in
    Distinct
'''
STAGING["stg_Auction"] = r'''
let
    Files = Folder.Files(DataFolder & "auction"),
    AuctionFiles = Table.SelectRows(Files, each Text.StartsWith(Text.Lower([Name]), "ipl_auction_") and Text.EndsWith(Text.Lower([Name]), ".csv")),
    // ipl_auction_2019.csv -> 2019. Each file is named for the season it was held for.
    WithSeason = Table.AddColumn(AuctionFiles, "AuctionSeason", each Number.From(Text.Select([Name], {"0".."9"})), Int64.Type),
    WithData = Table.AddColumn(WithSeason, "Data", each fnStandardiseAuctionFile(
        Table.PromoteHeaders(Csv.Document([Content], [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]), [PromoteAllScalars = true]))),
    Kept = Table.SelectColumns(WithData, {"AuctionSeason", "Data"}),
    Expanded = Table.ExpandTableColumn(Kept, "Data",
        {"Player", "Team", "Role", "Nationality", "BasePriceCr", "PriceCr", "Capped", "Status"}),
    Typed = Table.TransformColumnTypes(Expanded, {
        {"Player", type text}, {"Team", type text}, {"Role", type text}, {"Nationality", type text},
        {"BasePriceCr", type number}, {"PriceCr", type number}, {"Capped", type text}, {"Status", type text}}),
    SoldOnly = Table.SelectRows(Typed, each [Status] = "Sold" and [Player] <> null and [PriceCr] <> null and [PriceCr] > 0),
    WithTeamKey = Table.AddColumn(SoldOnly, "TeamKey", each fnTeamKey([Team]), type text),
    WithNameKey = Table.AddColumn(WithTeamKey, "NameKey", each fnNormName([Player]), type text),
    JoinOrigin = Table.NestedJoin(WithNameKey, {"NameKey", "AuctionSeason"}, stg_AuctionOrigin, {"NameKey", "Season"}, "O", JoinKind.LeftOuter),
    ExpOrigin = Table.ExpandTableColumn(JoinOrigin, "O", {"Role", "Nationality"}, {"O.Role", "O.Nationality"}),
    Join2025 = Table.NestedJoin(ExpOrigin, {"NameKey"}, stg_AuctionList2025, {"NameKey"}, "L", JoinKind.LeftOuter),
    Exp2025 = Table.ExpandTableColumn(Join2025, "L", {"Role", "Nationality"}, {"L.Role", "L.Nationality"}),
    WithRole = Table.AddColumn(Exp2025, "RoleStd", each List.First(List.RemoveNulls({fnStdRole([Role]), [O.Role], if [AuctionSeason] = 2025 then [L.Role] else null}), null), type text),
    WithNat = Table.AddColumn(WithRole, "NationalityStd", each List.First(List.RemoveNulls({fnStdNationality([Nationality]), [O.Nationality], if [AuctionSeason] = 2025 then [L.Nationality] else null}), null), type text),
    Final = Table.SelectColumns(WithNat, {"AuctionSeason", "Player", "Team", "TeamKey", "NameKey", "RoleStd", "NationalityStd", "BasePriceCr", "PriceCr", "Capped"}),
    Renamed = Table.RenameColumns(Final, {{"RoleStd", "Role"}, {"NationalityStd", "Nationality"}})
in
    Renamed
'''
STAGING["stg_Unsold"] = r'''
// Unsold players at the latest auction (Wisden list), for the "notable unsold" card.
let
    Source = fnReadCsv("supplementary\unsold_2026.csv"),
    Shaped = Table.FromRecords(List.Transform(Table.ToRecords(Source), (r) => [
        Season = 2026,
        Player = fnCleanText(r[Player]),
        NameKey = fnNormName(r[Player]),
        BasePriceCr = fnPriceToCr(r[BasePriceText], "rs"),
        Status = "Unsold"
    ]), type table [Season = Int64.Type, Player = text, NameKey = text, BasePriceCr = number, Status = text])
in
    Shaped
'''
STAGING["stg_Matches"] = r'''
let
    Files = Folder.Files(DataFolder & "cricsheet_ipl_json"),
    JsonFiles = Table.SelectRows(Files, each Text.Lower([Extension]) = ".json"),
    Parsed = Table.AddColumn(JsonFiles, "Match", each fnParseMatch(Json.Document([Content]), Number.From(Text.BeforeDelimiter([Name], ".")))),
    Kept = Table.SelectColumns(Parsed, {"Match"}),
    Expanded = Table.ExpandRecordColumn(Kept, "Match",
        {"MatchID", "Season", "MatchDate", "Venue", "Team1", "Team2", "Winner", "NoResult", "Appearances", "Deliveries", "Dismissals"}),
    // Season = calendar year of the match ("2020/21" in Cricsheet is the 2020 season).
    InWindow = Table.SelectRows(Expanded, each [Season] >= FirstSeason and [Season] <= LastSeason),
    Buffered = Table.Buffer(InWindow)
in
    Buffered
'''
STAGING["stg_Appearances"] = r'''
let
    Source = Table.SelectColumns(stg_Matches, {"Season", "Appearances"}),
    Expanded = Table.ExpandTableColumn(Source, "Appearances", {"MatchID", "TeamName", "PlayerName", "PlayerID"}),
    Typed = Table.TransformColumnTypes(Expanded, {{"Season", Int64.Type}, {"MatchID", Int64.Type}, {"TeamName", type text}, {"PlayerName", type text}, {"PlayerID", type text}}),
    WithTeamKey = Table.AddColumn(Typed, "TeamKey", each fnTeamKey([TeamName]), type text)
in
    WithTeamKey
'''
STAGING["stg_Deliveries"] = r'''
let
    Source = Table.SelectColumns(stg_Matches, {"Season", "Deliveries"}),
    Expanded = Table.ExpandTableColumn(Source, "Deliveries",
        {"MatchID", "BattingTeam", "BowlingTeam", "BatterID", "BowlerID", "BatterRuns", "Wides", "NoBalls", "Byes", "LegByes", "TotalRuns", "IsFour", "IsSix", "BowlerWickets", "BatterOut"}),
    Typed = Table.TransformColumnTypes(Expanded, {
        {"Season", Int64.Type}, {"MatchID", Int64.Type}, {"BattingTeam", type text}, {"BowlingTeam", type text},
        {"BatterID", type text}, {"BowlerID", type text}, {"BatterRuns", Int64.Type}, {"Wides", Int64.Type},
        {"NoBalls", Int64.Type}, {"Byes", Int64.Type}, {"LegByes", Int64.Type}, {"TotalRuns", Int64.Type},
        {"IsFour", Int64.Type}, {"IsSix", Int64.Type}, {"BowlerWickets", Int64.Type}, {"BatterOut", Int64.Type}}),
    WithKeys = Table.AddColumn(Table.AddColumn(Typed, "BattingTeamKey", each fnTeamKey([BattingTeam]), type text),
        "BowlingTeamKey", each fnTeamKey([BowlingTeam]), type text),
    // Legal ball = not a wide or no-ball. Balls faced excludes wides only.
    WithFlags = Table.AddColumn(Table.AddColumn(Table.AddColumn(Table.AddColumn(WithKeys,
        "Faced", each if [Wides] = 0 then 1 else 0, Int64.Type),
        "Legal", each if [Wides] = 0 and [NoBalls] = 0 then 1 else 0, Int64.Type),
        "Conceded", each [BatterRuns] + [Wides] + [NoBalls], Int64.Type),
        "Dot", each if [Wides] = 0 and [NoBalls] = 0 and [BatterRuns] + [Wides] + [NoBalls] = 0 then 1 else 0, Int64.Type)
in
    WithFlags
'''
STAGING["stg_Batting"] = r'''
let
    Grouped = Table.Group(stg_Deliveries, {"Season", "BatterID", "BattingTeamKey"}, {
        {"Runs", each List.Sum([BatterRuns]), Int64.Type},
        {"BallsFaced", each List.Sum([Faced]), Int64.Type},
        {"Fours", each List.Sum([IsFour]), Int64.Type},
        {"Sixes", each List.Sum([IsSix]), Int64.Type},
        {"Outs", each List.Sum([BatterOut]), Int64.Type}}),
    Renamed = Table.RenameColumns(Grouped, {{"BatterID", "PlayerID"}, {"BattingTeamKey", "TeamKey"}})
in
    Renamed
'''
STAGING["stg_Bowling"] = r'''
let
    // Runs conceded excludes byes and leg-byes; wickets exclude run outs, retirements and obstructing the field.
    Grouped = Table.Group(stg_Deliveries, {"Season", "BowlerID", "BowlingTeamKey"}, {
        {"LegalBalls", each List.Sum([Legal]), Int64.Type},
        {"RunsConceded", each List.Sum([Conceded]), Int64.Type},
        {"DotBalls", each List.Sum([Dot]), Int64.Type},
        {"Wickets", each List.Sum([BowlerWickets]), Int64.Type}}),
    Renamed = Table.RenameColumns(Grouped, {{"BowlerID", "PlayerID"}, {"BowlingTeamKey", "TeamKey"}})
in
    Renamed
'''
STAGING["stg_Fielding"] = r'''
let
    Source = Table.SelectColumns(stg_Matches, {"Season", "Dismissals"}),
    Expanded = Table.ExpandTableColumn(Source, "Dismissals", {"MatchID", "FieldingTeam", "FielderID", "Kind"}),
    Registered = Table.SelectRows(Expanded, each [FielderID] <> null and not Text.StartsWith([FielderID], "UNREG:")),
    WithKey = Table.AddColumn(Registered, "TeamKey", each fnTeamKey([FieldingTeam]), type text),
    Grouped = Table.Group(WithKey, {"Season", "FielderID", "TeamKey"}, {
        {"Catches", each List.Count(List.Select([Kind], each _ = "Catch")), Int64.Type},
        {"Stumpings", each List.Count(List.Select([Kind], each _ = "Stumping")), Int64.Type},
        {"RunOuts", each List.Count(List.Select([Kind], each _ = "RunOut")), Int64.Type}}),
    Renamed = Table.RenameColumns(Grouped, {{"FielderID", "PlayerID"}}),
    Typed = Table.TransformColumnTypes(Renamed, {{"Season", Int64.Type}})
in
    Typed
'''
STAGING["stg_PlayerSeasonStats"] = r'''
let
    // Matches = distinct matches in the playing XI for that team.
    Played = Table.Group(stg_Appearances, {"Season", "PlayerID", "TeamKey"}, {{"Matches", each List.Count(List.Distinct([MatchID])), Int64.Type}}),
    Keys = Table.Distinct(Table.Combine({
        Table.SelectColumns(Played, {"Season", "PlayerID", "TeamKey"}),
        Table.SelectColumns(stg_Batting, {"Season", "PlayerID", "TeamKey"}),
        Table.SelectColumns(stg_Bowling, {"Season", "PlayerID", "TeamKey"}),
        Table.SelectColumns(stg_Fielding, {"Season", "PlayerID", "TeamKey"})})),
    J1 = Table.ExpandTableColumn(Table.NestedJoin(Keys, {"Season", "PlayerID", "TeamKey"}, Played, {"Season", "PlayerID", "TeamKey"}, "P", JoinKind.LeftOuter), "P", {"Matches"}),
    J2 = Table.ExpandTableColumn(Table.NestedJoin(J1, {"Season", "PlayerID", "TeamKey"}, stg_Batting, {"Season", "PlayerID", "TeamKey"}, "B", JoinKind.LeftOuter), "B", {"Runs", "BallsFaced", "Fours", "Sixes", "Outs"}),
    J3 = Table.ExpandTableColumn(Table.NestedJoin(J2, {"Season", "PlayerID", "TeamKey"}, stg_Bowling, {"Season", "PlayerID", "TeamKey"}, "W", JoinKind.LeftOuter), "W", {"LegalBalls", "RunsConceded", "DotBalls", "Wickets"}),
    J4 = Table.ExpandTableColumn(Table.NestedJoin(J3, {"Season", "PlayerID", "TeamKey"}, stg_Fielding, {"Season", "PlayerID", "TeamKey"}, "F", JoinKind.LeftOuter), "F", {"Catches", "Stumpings", "RunOuts"}),
    Metrics = {"Matches", "Runs", "BallsFaced", "Fours", "Sixes", "Outs", "LegalBalls", "RunsConceded", "DotBalls", "Wickets", "Catches", "Stumpings", "RunOuts"},
    Zeroed = Table.ReplaceValue(J4, null, 0, Replacer.ReplaceValue, Metrics),
    Typed = Table.TransformColumnTypes(Zeroed, List.Transform(Metrics, each {_, Int64.Type}) & {{"Season", Int64.Type}}),
    // Impact Points: run 1, four bonus 1, six bonus 2, wicket 25, dot ball 1, catch 8, stumping 12, run-out involvement 6
    WithImpact = Table.AddColumn(Typed, "ImpactPoints", each
        [Runs] + [Fours] + 2 * [Sixes] + 25 * [Wickets] + [DotBalls] + 8 * [Catches] + 12 * [Stumpings] + 6 * [RunOuts], Int64.Type)
in
    WithImpact
'''
STAGING["stg_RegisterVariants"] = r'''
// Every Cricsheet name variant (people.csv name + unique_name, plus names.csv), normalised.
let
    People = fnReadCsv("register\people.csv"),
    Names = fnReadCsv("register\names.csv"),
    FromPeople = Table.Combine({
        Table.RenameColumns(Table.SelectColumns(People, {"identifier", "name"}), {{"identifier", "PlayerID"}, {"name", "Variant"}}),
        Table.RenameColumns(Table.SelectColumns(People, {"identifier", "unique_name"}), {{"identifier", "PlayerID"}, {"unique_name", "Variant"}})}),
    FromNames = Table.RenameColumns(Table.SelectColumns(Names, {"identifier", "name"}), {{"identifier", "PlayerID"}, {"name", "Variant"}}),
    All = Table.Combine({FromPeople, FromNames}),
    WithKey = Table.AddColumn(All, "VKey", each fnNormName([Variant]), type text),
    Distinct = Table.Distinct(Table.SelectRows(Table.SelectColumns(WithKey, {"PlayerID", "VKey"}), each [VKey] <> null)),
    Buffered = Table.Buffer(Distinct)
in
    Buffered
'''
STAGING["stg_IplVariants"] = r'''
// Name variants restricted to people who played IPL matches in the window, plus the exact match-file names.
let
    IplIds = Table.Distinct(Table.SelectColumns(stg_Appearances, {"PlayerID"})),
    FromRegister = Table.Join(stg_RegisterVariants, "PlayerID", Table.RenameColumns(IplIds, {{"PlayerID", "IplID"}}), "IplID", JoinKind.Inner),
    FromMatches = Table.Distinct(Table.AddColumn(Table.SelectColumns(stg_Appearances, {"PlayerID", "PlayerName"}), "VKey", each fnNormName([PlayerName]), type text)),
    All = Table.Distinct(Table.Combine({Table.SelectColumns(FromRegister, {"PlayerID", "VKey"}), Table.SelectColumns(FromMatches, {"PlayerID", "VKey"})})),
    Buffered = Table.Buffer(All)
in
    Buffered
'''
STAGING["stg_NameFixesRaw"] = r'''
// name_fixes.csv as-is (AuctionName, PlayerID, Note, DisplayName). Only this query touches the file.
let
    Source = fnReadCsv("mappings\name_fixes.csv"),
    WithDisplay = if Table.HasColumns(Source, "DisplayName") then Source else Table.AddColumn(Source, "DisplayName", each null, type text)
in
    WithDisplay
'''
STAGING["stg_NameFixes"] = r'''
let
    Source = stg_NameFixesRaw,
    WithKey = Table.AddColumn(Source, "NameKey", each fnNormName([AuctionName]), type text),
    Kept = Table.Distinct(Table.SelectColumns(Table.SelectRows(WithKey, each fnCleanText([PlayerID]) <> null), {"NameKey", "PlayerID"}), {"NameKey"})
in
    Kept
'''
STAGING["stg_NameMatch"] = r'''
// Auction name -> Cricsheet PlayerID, one row per (AuctionSeason, TeamKey, NameKey).
// Passes, in priority order:
//   0 Manual        name_fixes.csv
//   1 Exact         full name equals a register variant, unique among IPL players
//   2 ExactRegister full name equals a register variant, unique in the whole register
//   3 Initials      "Virat Kohli" -> "V Kohli", among players who played for that team in the contract window
//   4 Surname       same surname and first initial, unique in that team-window roster
//   5 Fuzzy         Power Query fuzzy merge (similarity >= 0.8) against that roster
let
    Keys = Table.Distinct(Table.SelectColumns(stg_Auction, {"AuctionSeason", "TeamKey", "NameKey"})),
    UniqueOf = (variants as table) as table =>
        let
            G = Table.Group(variants, {"VKey"}, {{"N", each List.Count(List.Distinct([PlayerID])), Int64.Type}, {"PlayerID", each List.First([PlayerID]), type text}})
        in
            Table.SelectColumns(Table.SelectRows(G, each [N] = 1), {"VKey", "PlayerID"}),
    UniqueIpl = UniqueOf(stg_IplVariants),
    UniqueRegister = UniqueOf(stg_RegisterVariants),
    P0 = Table.AddColumn(Table.Join(Keys, "NameKey", Table.RenameColumns(stg_NameFixes, {{"NameKey", "FixKey"}}), "FixKey", JoinKind.Inner), "Pass", each 0, Int64.Type),
    P1 = Table.AddColumn(Table.Join(Keys, "NameKey", Table.RenameColumns(UniqueIpl, {{"VKey", "FixKey"}}), "FixKey", JoinKind.Inner), "Pass", each 1, Int64.Type),
    P2 = Table.AddColumn(Table.Join(Keys, "NameKey", Table.RenameColumns(UniqueRegister, {{"VKey", "FixKey"}}), "FixKey", JoinKind.Inner), "Pass", each 2, Int64.Type),
    Exact = Table.SelectColumns(Table.Combine({P0, P1, P2}), {"AuctionSeason", "TeamKey", "NameKey", "PlayerID", "Pass"}),
    Leftover = Table.SelectRows(Table.NestedJoin(Keys, {"AuctionSeason", "TeamKey", "NameKey"}, Exact, {"AuctionSeason", "TeamKey", "NameKey"}, "E", JoinKind.LeftAnti), each true),
    LeftKeys = Table.RemoveColumns(Leftover, {"E"}),
    // Roster scope: anyone who played for that TeamKey in the auction season or the next three.
    Roster = Table.Distinct(Table.SelectColumns(stg_Appearances, {"PlayerID", "TeamKey", "Season"})),
    Window = Table.ExpandListColumn(Table.AddColumn(LeftKeys, "Season", each List.Numbers([AuctionSeason], 4)), "Season"),
    WindowTyped = Table.TransformColumnTypes(Window, {{"Season", Int64.Type}}),
    InRoster = Table.Join(WindowTyped, {"TeamKey", "Season"}, Table.RenameColumns(Roster, {{"TeamKey", "RTeamKey"}, {"Season", "RSeason"}}), {"RTeamKey", "RSeason"}, JoinKind.Inner),
    CandidateIds = Table.Distinct(Table.SelectColumns(InRoster, {"AuctionSeason", "TeamKey", "NameKey", "PlayerID"})),
    Candidates = Table.Join(CandidateIds, "PlayerID", Table.RenameColumns(stg_IplVariants, {{"PlayerID", "VPlayerID"}}), "VPlayerID", JoinKind.Inner),
    WithTests = Table.AddColumn(Table.AddColumn(Candidates,
        "IsInitials", each [VKey] = fnNormName(fnInitialsKey([NameKey])), type logical),
        "IsSurname", each List.Last(Text.Split([VKey], " ")) = List.Last(Text.Split([NameKey], " ")) and Text.Start([VKey], 1) = Text.Start([NameKey], 1), type logical),
    UniqueHit = (flag as text, pass as number) as table =>
        let
            Hits = Table.SelectRows(WithTests, each Record.Field(_, flag)),
            G = Table.Group(Hits, {"AuctionSeason", "TeamKey", "NameKey"}, {{"N", each List.Count(List.Distinct([PlayerID])), Int64.Type}, {"PlayerID", each List.First([PlayerID]), type text}}),
            One = Table.SelectRows(G, each [N] = 1)
        in
            Table.AddColumn(Table.RemoveColumns(One, {"N"}), "Pass", each pass, Int64.Type),
    P3 = UniqueHit("IsInitials", 3),
    P4 = UniqueHit("IsSurname", 4),
    // Fuzzy pass: one scoped fuzzy merge per leftover name.
    FuzzyGroups = Table.Group(Candidates, {"AuctionSeason", "TeamKey", "NameKey"}, {{"Cands", each Table.Distinct(Table.SelectColumns(_, {"PlayerID", "VKey"})), type table}}),
    FuzzyMatched = Table.AddColumn(FuzzyGroups, "PlayerID", each
        let
            Probe = #table(type table [NameKey = text], {{[NameKey]}}),
            J = Table.FuzzyNestedJoin(Probe, {"NameKey"}, [Cands], {"VKey"}, "M", JoinKind.LeftOuter, [Threshold = 0.8, IgnoreCase = true, IgnoreSpace = true]),
            Matches = J{0}[M],
            // An unmatched fuzzy join returns an empty table without columns.
            Ids = if Table.HasColumns(Matches, "PlayerID") then List.Distinct(Matches[PlayerID]) else {}
        in
            if List.Count(Ids) = 1 then Ids{0} else null, type text),
    P5 = Table.AddColumn(Table.SelectRows(Table.RemoveColumns(FuzzyMatched, {"Cands"}), each [PlayerID] <> null), "Pass", each 5, Int64.Type),
    All = Table.Combine({Exact, P3, P4, P5}),
    Best = Table.Group(All, {"AuctionSeason", "TeamKey", "NameKey"}, {{"Pass", each List.Min([Pass]), Int64.Type},
        {"PlayerID", (g) => Table.SelectRows(g, each [Pass] = List.Min(g[Pass])){0}[PlayerID], type text}}),
    WithLabel = Table.AddColumn(Best, "MatchPass", each {"Manual", "Exact", "Exact (register)", "Initials", "Surname", "Fuzzy"}{[Pass]}, type text)
in
    WithLabel
'''
STAGING["stg_AuctionMatched"] = r'''
let
    Joined = Table.NestedJoin(stg_Auction, {"AuctionSeason", "TeamKey", "NameKey"}, stg_NameMatch, {"AuctionSeason", "TeamKey", "NameKey"}, "M", JoinKind.LeftOuter),
    Expanded = Table.ExpandTableColumn(Joined, "M", {"PlayerID", "MatchPass"}),
    // Unmatched buys keep their spend under a synthetic key so totals stay complete.
    WithKey = Table.AddColumn(Expanded, "PlayerKey", each if [PlayerID] <> null then [PlayerID] else "A_" & Text.Replace([NameKey], " ", "_"), type text),
    WithFlag = Table.AddColumn(WithKey, "IsMatched", each [PlayerID] <> null, type logical),
    WithPass = Table.ReplaceValue(WithFlag, null, "Unmatched", Replacer.ReplaceValue, {"MatchPass"}),
    // Base price is only published for 2025-26. Earlier, a buy at the minimum base price of that era counts as a base-price buy.
    MinBase = (s as number) as number => if s >= 2025 then 0.30 else if s >= 2018 then 0.20 else 0.10,
    WithBracket = Table.AddColumn(WithPass, "PriceBracket", each
        if ([BasePriceCr] <> null and Number.Abs([PriceCr] - [BasePriceCr]) < 0.001) or ([BasePriceCr] = null and [PriceCr] <= MinBase([AuctionSeason]) * 1.1) then "Base price buy"
        else if [PriceCr] < 2 then "Under 2 Cr"
        else if [PriceCr] < 5 then "2 to 5 Cr"
        else if [PriceCr] < 10 then "5 to 10 Cr"
        else "10 Cr and above", type text),
    WithOrder = Table.AddColumn(WithBracket, "PriceBracketOrder", each List.PositionOf({"Base price buy", "Under 2 Cr", "2 to 5 Cr", "5 to 10 Cr", "10 Cr and above"}, [PriceBracket]) + 1, Int64.Type),
    // If a player appears twice for the same team in one auction file, keep the higher price.
    Sorted = Table.Buffer(Table.Sort(WithOrder, {{"PriceCr", Order.Descending}})),
    Deduped = Table.Distinct(Sorted, {"PlayerKey", "TeamKey", "AuctionSeason"})
in
    Deduped
'''
STAGING["stg_Contracts"] = r'''
// One row per auction buy per season it covers.
// ContractEnd = earliest of (player's next auction season - 1, next mega auction - 1, LastSeason).
// Seasons after the buy are kept only while the player still appears for that team (released players drop out).
let
    MegaAuctions = {2014, 2018, 2022, 2025},
    Buys = Table.SelectColumns(stg_AuctionMatched, {"PlayerKey", "PlayerID", "TeamKey", "AuctionSeason", "PriceCr", "BasePriceCr", "PriceBracket", "PriceBracketOrder"}),
    SeasonsByPlayer = Table.Group(Buys, {"PlayerKey"}, {{"AllAuctions", each List.Distinct([AuctionSeason]), type list}}),
    WithAll = Table.ExpandTableColumn(Table.NestedJoin(Buys, {"PlayerKey"}, SeasonsByPlayer, {"PlayerKey"}, "S", JoinKind.LeftOuter), "S", {"AllAuctions"}),
    PlayedSeasons = Table.Group(Table.Distinct(Table.SelectColumns(stg_Appearances, {"PlayerID", "TeamKey", "Season"})), {"PlayerID", "TeamKey"}, {{"PlayedSeasons", each [Season], type list}}),
    WithPlayed = Table.ExpandTableColumn(Table.NestedJoin(WithAll, {"PlayerID", "TeamKey"}, PlayedSeasons, {"PlayerID", "TeamKey"}, "P", JoinKind.LeftOuter), "P", {"PlayedSeasons"}),
    WithEnd = Table.AddColumn(WithPlayed, "ContractEnd", each
        let
            s = [AuctionSeason],
            NextAuction = List.Min(List.Select([AllAuctions], (a) => a > s)),
            NextMega = List.Min(List.Select(MegaAuctions, (m) => m > s))
        in
            List.Min(List.RemoveNulls({LastSeason, if NextAuction = null then null else NextAuction - 1, if NextMega = null then null else NextMega - 1})), Int64.Type),
    WithSeasons = Table.AddColumn(WithEnd, "Season", each
        let
            s = [AuctionSeason],
            Played = if [PlayedSeasons] = null then {} else List.Select([PlayedSeasons], (p) => p >= s and p <= [ContractEnd]),
            LastPlayed = List.Max(Played, s)
        in
            List.Select(List.Numbers(s, [ContractEnd] - s + 1), (x) => x = s or x <= LastPlayed)),
    Expanded = Table.ExpandListColumn(WithSeasons, "Season"),
    Typed = Table.TransformColumnTypes(Expanded, {{"Season", Int64.Type}}),
    Sorted = Table.Buffer(Table.Sort(Typed, {{"AuctionSeason", Order.Descending}})),
    Deduped = Table.Distinct(Sorted, {"PlayerKey", "TeamKey", "Season"}),
    Final = Table.RemoveColumns(Deduped, {"AllAuctions", "PlayedSeasons"})
in
    Final
'''

# --------------------------------------------------------------------------
# Loaded tables
# --------------------------------------------------------------------------
TABLES = {}

TABLES["FactPlayerSeason"] = dict(
    m=r'''
let
    Joined = Table.NestedJoin(stg_PlayerSeasonStats, {"Season", "PlayerID", "TeamKey"}, stg_Contracts, {"Season", "PlayerKey", "TeamKey"}, "C", JoinKind.FullOuter),
    Expanded = Table.ExpandTableColumn(Joined, "C",
        {"Season", "PlayerKey", "TeamKey", "AuctionSeason", "PriceCr", "BasePriceCr", "PriceBracket", "PriceBracketOrder"},
        {"C.Season", "C.PlayerKey", "C.TeamKey", "AuctionSeason", "PriceCr", "BasePriceCr", "PriceBracket", "PriceBracketOrder"}),
    Keys = Table.AddColumn(Table.AddColumn(Table.AddColumn(Expanded,
        "Season2", each if [Season] <> null then [Season] else [C.Season], Int64.Type),
        "PlayerID2", each if [PlayerID] <> null then [PlayerID] else [C.PlayerKey], type text),
        "TeamKey2", each if [TeamKey] <> null then [TeamKey] else [C.TeamKey], type text),
    Dropped = Table.RemoveColumns(Keys, {"Season", "PlayerID", "TeamKey", "C.Season", "C.PlayerKey", "C.TeamKey"}),
    Renamed = Table.RenameColumns(Dropped, {{"Season2", "Season"}, {"PlayerID2", "PlayerID"}, {"TeamKey2", "TeamKey"}}),
    Metrics = {"Matches", "Runs", "BallsFaced", "Fours", "Sixes", "Outs", "LegalBalls", "RunsConceded", "DotBalls", "Wickets", "Catches", "Stumpings", "RunOuts", "ImpactPoints"},
    Zeroed = Table.ReplaceValue(Renamed, null, 0, Replacer.ReplaceValue, Metrics),
    WithSource = Table.AddColumn(Zeroed, "PriceSource", each if [PriceCr] <> null then "Auction" else "Unpriced", type text),
    BracketFilled = Table.ReplaceValue(WithSource, null, "Unpriced", Replacer.ReplaceValue, {"PriceBracket"}),
    OrderFilled = Table.ReplaceValue(BracketFilled, null, 9, Replacer.ReplaceValue, {"PriceBracketOrder"}),
    // Season medians of priced player-seasons, used by the Value Quadrant column.
    Priced = Table.SelectRows(OrderFilled, each [PriceSource] = "Auction"),
    Medians = Table.Group(Priced, {"Season"}, {{"MedianPriceCr", each List.Median([PriceCr]), type number}, {"MedianImpact", each List.Median([ImpactPoints]), type number}}),
    WithMedians = Table.ExpandTableColumn(Table.NestedJoin(OrderFilled, {"Season"}, Medians, {"Season"}, "Med", JoinKind.LeftOuter), "Med", {"MedianPriceCr", "MedianImpact"}),
    WithRowKey0 = Table.AddColumn(WithMedians, "PlayerSeasonKey", each Text.From([Season]) & "|" & [PlayerID] & "|" & [TeamKey], type text),
    WithRowKey = Table.AddColumn(WithRowKey0, "TeamSeasonKey", each [TeamKey] & "|" & Text.From([Season]), type text),
    Typed = Table.TransformColumnTypes(WithRowKey, List.Transform(Metrics, each {_, Int64.Type}) & {
        {"Season", Int64.Type}, {"AuctionSeason", Int64.Type}, {"PriceCr", type number}, {"BasePriceCr", type number}, {"PriceBracketOrder", Int64.Type}}),
    Ordered = Table.SelectColumns(Typed, {"PlayerSeasonKey", "TeamSeasonKey", "PlayerID", "TeamKey", "Season", "Matches", "Runs", "BallsFaced", "Fours", "Sixes", "Outs",
        "Wickets", "LegalBalls", "RunsConceded", "DotBalls", "Catches", "Stumpings", "RunOuts", "ImpactPoints",
        "PriceCr", "BasePriceCr", "PriceBracket", "PriceBracketOrder", "PriceSource", "AuctionSeason", "MedianPriceCr", "MedianImpact"})
in
    Ordered
''',
    columns=[
        ("PlayerSeasonKey", "string", dict(hidden=True)),
        ("TeamSeasonKey", "string", dict(hidden=True)),
        ("PlayerID", "string", dict(hidden=True)),
        ("TeamKey", "string", dict(hidden=True)),
        ("Season", "int64", dict(hidden=True)),
        ("Matches", "int64", {}), ("Runs", "int64", {}), ("BallsFaced", "int64", {}), ("Fours", "int64", {}),
        ("Sixes", "int64", {}), ("Outs", "int64", {}), ("Wickets", "int64", {}), ("LegalBalls", "int64", {}),
        ("RunsConceded", "int64", {}), ("DotBalls", "int64", {}), ("Catches", "int64", {}), ("Stumpings", "int64", {}),
        ("RunOuts", "int64", {}), ("ImpactPoints", "int64", {}),
        ("PriceCr", "double", dict(fmt="#,0.00")),
        ("BasePriceCr", "double", dict(fmt="#,0.00")),
        ("PriceBracket", "string", dict(sortBy="PriceBracketOrder")),
        ("PriceBracketOrder", "int64", dict(hidden=True, noSum=True)),
        ("PriceSource", "string", {}),
        ("AuctionSeason", "int64", dict(noSum=True)),
        ("MedianPriceCr", "double", dict(hidden=True, noSum=True)),
        ("MedianImpact", "double", dict(hidden=True, noSum=True)),
    ],
    calc_columns=[
        ("Value Quadrant", "string", r'''
-- Compares each priced player-season with the median price and median Impact Points of priced players in the same season.
VAR medPrice = FactPlayerSeason[MedianPriceCr]
VAR medImpact = FactPlayerSeason[MedianImpact]
VAR p = FactPlayerSeason[PriceCr]
VAR i = FactPlayerSeason[ImpactPoints]
RETURN
    SWITCH (
        TRUE (),
        FactPlayerSeason[PriceSource] <> "Auction", "Unpriced",
        FactPlayerSeason[Matches] < 5, "Too few matches",
        p >= medPrice && i >= medImpact, "Star",
        p < medPrice && i >= medImpact, "Steal",
        p >= medPrice && i < medImpact, "Overpaid",
        "Passenger"
    )
''', dict(sortBy="Quadrant Order")),
        ("Quadrant Order", "int64", r'''
-- Same rule as Value Quadrant, returned as a sort order (kept independent so the two columns do not depend on each other).
VAR p = FactPlayerSeason[PriceCr]
VAR i = FactPlayerSeason[ImpactPoints]
RETURN
    SWITCH (
        TRUE (),
        FactPlayerSeason[PriceSource] <> "Auction", 6,
        FactPlayerSeason[Matches] < 5, 5,
        p < FactPlayerSeason[MedianPriceCr] && i >= FactPlayerSeason[MedianImpact], 1,
        p >= FactPlayerSeason[MedianPriceCr] && i >= FactPlayerSeason[MedianImpact], 2,
        p < FactPlayerSeason[MedianPriceCr] && i < FactPlayerSeason[MedianImpact], 3,
        4
    )
''', dict(hidden=True, noSum=True)),
    ],
)

TABLES["FactAuction"] = dict(
    m=r'''
let
    Source = stg_AuctionMatched,
    Renamed = Table.RenameColumns(Source, {{"PlayerKey", "PlayerKeyOut"}, {"AuctionSeason", "Season"}, {"Player", "AuctionName"}, {"Role", "AuctionRole"}}),
    WithRowKey = Table.AddColumn(Renamed, "AuctionKey", each Text.From([Season]) & "|" & [PlayerKeyOut] & "|" & [TeamKey], type text),
    Kept = Table.SelectColumns(WithRowKey, {"AuctionKey", "PlayerKeyOut", "TeamKey", "Season", "AuctionName", "AuctionRole", "Capped", "BasePriceCr", "PriceCr", "PriceBracket", "PriceBracketOrder", "MatchPass", "IsMatched"}),
    Final = Table.RenameColumns(Kept, {{"PlayerKeyOut", "PlayerID"}}),
    Typed = Table.TransformColumnTypes(Final, {{"Season", Int64.Type}, {"BasePriceCr", type number}, {"PriceCr", type number}, {"PriceBracketOrder", Int64.Type}, {"IsMatched", type logical}})
in
    Typed
''',
    columns=[
        ("AuctionKey", "string", dict(hidden=True)),
        ("PlayerID", "string", dict(hidden=True)),
        ("TeamKey", "string", dict(hidden=True)),
        ("Season", "int64", dict(hidden=True)),
        ("AuctionName", "string", {}),
        ("AuctionRole", "string", {}),
        ("Capped", "string", {}),
        ("BasePriceCr", "double", dict(fmt="#,0.00")),
        ("PriceCr", "double", dict(fmt="#,0.00")),
        ("PriceBracket", "string", dict(sortBy="PriceBracketOrder")),
        ("PriceBracketOrder", "int64", dict(hidden=True, noSum=True)),
        ("MatchPass", "string", {}),
        ("IsMatched", "boolean", {}),
    ],
)

TABLES["FactTeamMatch"] = dict(
    m=r'''
let
    Source = Table.SelectColumns(stg_Matches, {"MatchID", "Season", "MatchDate", "Venue", "Team1", "Team2", "Winner", "NoResult"}),
    // Unpivot team 1 and team 2 into one row per team per match.
    Rows = Table.Combine({
        Table.RenameColumns(Table.RemoveColumns(Source, {"Team2"}), {{"Team1", "TeamName"}}),
        Table.RenameColumns(Table.RemoveColumns(Source, {"Team1"}), {{"Team2", "TeamName"}})}),
    WithKey = Table.AddColumn(Rows, "TeamKey", each fnTeamKey([TeamName]), type text),
    WithWon = Table.AddColumn(WithKey, "Won", each if [Winner] <> null and [Winner] = [TeamName] then 1 else 0, Int64.Type),
    WithRowKey0 = Table.AddColumn(WithWon, "TeamMatchKey", each Text.From([MatchID]) & "|" & [TeamKey], type text),
    WithRowKey = Table.AddColumn(WithRowKey0, "TeamSeasonKey", each [TeamKey] & "|" & Text.From([Season]), type text),
    Kept = Table.SelectColumns(WithRowKey, {"TeamMatchKey", "TeamSeasonKey", "MatchID", "TeamKey", "Season", "MatchDate", "Venue", "Won", "NoResult"}),
    Typed = Table.TransformColumnTypes(Kept, {{"MatchID", Int64.Type}, {"Season", Int64.Type}, {"MatchDate", type date}, {"Venue", type text}, {"NoResult", Int64.Type}})
in
    Typed
''',
    columns=[
        ("TeamMatchKey", "string", dict(hidden=True)),
        ("TeamSeasonKey", "string", dict(hidden=True)),
        ("MatchID", "int64", dict(hidden=True, noSum=True)),
        ("TeamKey", "string", dict(hidden=True)),
        ("Season", "int64", dict(hidden=True)),
        ("MatchDate", "dateTime", dict(fmt="dd mmm yyyy")),
        ("Venue", "string", {}),
        ("Won", "int64", {}),
        ("NoResult", "int64", {}),
    ],
)

TABLES["DimPlayer"] = dict(
    m=r'''
let
    FromStats = Table.SelectColumns(stg_PlayerSeasonStats, {"PlayerID"}),
    FromAuction = Table.RenameColumns(Table.SelectColumns(stg_AuctionMatched, {"PlayerKey"}), {{"PlayerKey", "PlayerID"}}),
    Ids = Table.Distinct(Table.Combine({FromStats, FromAuction})),
    // Cricsheet display name (most frequent name in match files).
    CsNames = Table.Group(stg_Appearances, {"PlayerID"}, {{"CricsheetName", each List.Mode([PlayerName]), type text}}),
    // Latest auction row per player: name, role, nationality, team.
    AuctionSorted = Table.Buffer(Table.Sort(stg_AuctionMatched, {{"AuctionSeason", Order.Descending}})),
    LatestAuction = Table.Group(AuctionSorted, {"PlayerKey"}, {
        {"AuctionName", each List.First([Player]), type text},
        {"AuctionRole", each List.First(List.RemoveNulls([Role]), null), type text},
        {"Nationality", each List.First(List.RemoveNulls([Nationality]), null), type text},
        {"AuctionTeamKey", each List.First([TeamKey]), type text},
        {"AuctionsBought", each List.Count([AuctionSeason]), Int64.Type}}),
    Career = Table.Group(stg_PlayerSeasonStats, {"PlayerID"}, {
        {"CareerMatches", each List.Sum([Matches]), Int64.Type},
        {"CareerBallsFaced", each List.Sum([BallsFaced]), Int64.Type},
        {"CareerLegalBalls", each List.Sum([LegalBalls]), Int64.Type},
        {"CareerStumpings", each List.Sum([Stumpings]), Int64.Type},
        {"FirstSeason", each List.Min([Season]), Int64.Type},
        {"LastSeason", each List.Max([Season]), Int64.Type}}),
    LatestTeam = Table.Group(Table.Buffer(Table.Sort(stg_PlayerSeasonStats, {{"Season", Order.Descending}, {"Matches", Order.Descending}})), {"PlayerID"}, {{"StatsTeamKey", each List.First([TeamKey]), type text}}),
    J1 = Table.ExpandTableColumn(Table.NestedJoin(Ids, {"PlayerID"}, CsNames, {"PlayerID"}, "N", JoinKind.LeftOuter), "N", {"CricsheetName"}),
    J2 = Table.ExpandTableColumn(Table.NestedJoin(J1, {"PlayerID"}, LatestAuction, {"PlayerKey"}, "A", JoinKind.LeftOuter), "A", {"AuctionName", "AuctionRole", "Nationality", "AuctionTeamKey", "AuctionsBought"}),
    J3 = Table.ExpandTableColumn(Table.NestedJoin(J2, {"PlayerID"}, Career, {"PlayerID"}, "C", JoinKind.LeftOuter), "C", {"CareerMatches", "CareerBallsFaced", "CareerLegalBalls", "CareerStumpings", "FirstSeason", "LastSeason"}),
    J4 = Table.ExpandTableColumn(Table.NestedJoin(J3, {"PlayerID"}, LatestTeam, {"PlayerID"}, "T", JoinKind.LeftOuter), "T", {"StatsTeamKey"}),
    // Role: latest auction role; otherwise derived from career output.
    WithRole = Table.AddColumn(J4, "Role", each
        if [AuctionRole] <> null then [AuctionRole]
        else if [CareerMatches] = null or [CareerMatches] = 0 then "Unknown"
        else if [CareerStumpings] > 0 then "Wicket-Keeper"
        else
            let
                Share = [CareerLegalBalls] / List.Max({1, [CareerLegalBalls] + [CareerBallsFaced]})
            in
                if Share >= 0.65 then "Bowler" else if Share <= 0.15 then "Batter" else "All-Rounder", type text),
    WithRoleSource = Table.AddColumn(WithRole, "RoleSource", each if [AuctionRole] <> null then "Auction file" else "Derived from stats", type text),
    WithNat = Table.ReplaceValue(WithRoleSource, null, "Unknown", Replacer.ReplaceValue, {"Nationality"}),
    BaseName = Table.AddColumn(WithNat, "BaseName", each if [AuctionName] <> null then [AuctionName] else if [CricsheetName] <> null then [CricsheetName] else [PlayerID], type text),
    // Display names must be unique for drill-through; disambiguate duplicates with the Cricsheet name or ID.
    NameCounts = Table.Group(BaseName, {"BaseName"}, {{"NameCount", each Table.RowCount(_), Int64.Type}}),
    WithCount = Table.ExpandTableColumn(Table.NestedJoin(BaseName, {"BaseName"}, NameCounts, {"BaseName"}, "K", JoinKind.LeftOuter), "K", {"NameCount"}),
    WithName0 = Table.AddColumn(WithCount, "PlayerName0", each
        if [NameCount] = 1 then [BaseName]
        else [BaseName] & " (" & (if [CricsheetName] <> null and [CricsheetName] <> [BaseName] then [CricsheetName] else [PlayerID]) & ")", type text),
    // Optional DisplayName overrides from name_fixes.csv (for odd auction spellings).
    Overrides = Table.Distinct(Table.SelectRows(Table.SelectColumns(stg_NameFixesRaw, {"PlayerID", "DisplayName"}), each fnCleanText([DisplayName]) <> null), {"PlayerID"}),
    WithOverride = Table.ExpandTableColumn(Table.NestedJoin(WithName0, {"PlayerID"}, Overrides, {"PlayerID"}, "D", JoinKind.LeftOuter), "D", {"DisplayName"}),
    WithName = Table.AddColumn(WithOverride, "PlayerName", each if [DisplayName] <> null then [DisplayName] else [PlayerName0], type text),
    WithTeam = Table.AddColumn(WithName, "LatestTeamKey", each if [StatsTeamKey] <> null then [StatsTeamKey] else [AuctionTeamKey], type text),
    WithMatched = Table.AddColumn(WithTeam, "HasCricsheetID", each not Text.StartsWith([PlayerID], "A_"), type logical),
    WithAuctioned = Table.AddColumn(WithMatched, "EverAuctioned", each [AuctionsBought] <> null, type logical),
    Final = Table.SelectColumns(WithAuctioned, {"PlayerID", "PlayerName", "CricsheetName", "Role", "RoleSource", "Nationality", "LatestTeamKey", "FirstSeason", "LastSeason", "HasCricsheetID", "EverAuctioned"}),
    Typed = Table.TransformColumnTypes(Final, {{"FirstSeason", Int64.Type}, {"LastSeason", Int64.Type}})
in
    Typed
''',
    columns=[
        ("PlayerID", "string", dict(hidden=True)),
        ("PlayerName", "string", {}),
        ("CricsheetName", "string", {}),
        ("Role", "string", {}),
        ("RoleSource", "string", {}),
        ("Nationality", "string", {}),
        ("LatestTeamKey", "string", {}),
        ("FirstSeason", "int64", dict(noSum=True)),
        ("LastSeason", "int64", dict(noSum=True)),
        ("HasCricsheetID", "boolean", {}),
        ("EverAuctioned", "boolean", {}),
    ],
)

TABLES["DimTeam"] = dict(
    m=r'''
let
    Source = Table.Distinct(Table.SelectColumns(stg_TeamMap, {"TeamKey", "TeamName", "TeamColour", "IsActive"}), {"TeamKey"}),
    WithCode = Table.AddColumn(Source, "ShortCode", each [TeamKey], type text),
    Final = Table.SelectColumns(WithCode, {"TeamKey", "TeamName", "ShortCode", "TeamColour", "IsActive"})
in
    Final
''',
    columns=[
        ("TeamKey", "string", dict(hidden=True)),
        ("TeamName", "string", {}),
        ("ShortCode", "string", {}),
        ("TeamColour", "string", {}),
        ("IsActive", "boolean", {}),
    ],
)

TABLES["DimSeason"] = dict(
    m=r'''
let
    Seasons = List.Numbers(FirstSeason, LastSeason - FirstSeason + 1),
    MegaAuctions = {2014, 2018, 2022, 2025},
    Base = Table.FromList(Seasons, Splitter.SplitByNothing(), type table [Season = Int64.Type]),
    WithLabel = Table.AddColumn(Base, "SeasonLabel", each "IPL " & Text.From([Season]), type text),
    WithMega = Table.AddColumn(WithLabel, "IsMegaAuction", each List.Contains(MegaAuctions, [Season]), type logical),
    WithType = Table.AddColumn(WithMega, "AuctionType", each if [IsMegaAuction] then "Mega auction" else "Mini auction", type text)
in
    WithType
''',
    columns=[
        ("Season", "int64", dict(noSum=True, fmt="0")),
        ("SeasonLabel", "string", dict(sortBy="Season")),
        ("IsMegaAuction", "boolean", {}),
        ("AuctionType", "string", {}),
    ],
)

TABLES["DimTeamSeason"] = dict(
    m=r'''
// One row per franchise per season it played: lets one scatter dot represent a team-season.
let
    Played = Table.Distinct(Table.SelectColumns(stg_Appearances, {"TeamKey", "Season"})),
    Teams = Table.Distinct(Table.SelectColumns(stg_TeamMap, {"TeamKey", "TeamColour"}), {"TeamKey"}),
    WithColour = Table.ExpandTableColumn(Table.NestedJoin(Played, {"TeamKey"}, Teams, {"TeamKey"}, "T", JoinKind.LeftOuter), "T", {"TeamColour"}),
    WithKey = Table.AddColumn(WithColour, "TeamSeasonKey", each [TeamKey] & "|" & Text.From([Season]), type text),
    WithLabel = Table.AddColumn(WithKey, "TeamSeasonLabel", each [TeamKey] & " " & Text.From([Season]), type text),
    Final = Table.SelectColumns(WithLabel, {"TeamSeasonKey", "TeamSeasonLabel", "TeamKey", "Season", "TeamColour"}),
    Typed = Table.TransformColumnTypes(Final, {{"Season", Int64.Type}})
in
    Typed
''',
    columns=[
        ("TeamSeasonKey", "string", dict(hidden=True)),
        ("TeamSeasonLabel", "string", {}),
        ("TeamKey", "string", dict(hidden=True)),
        ("Season", "int64", dict(hidden=True, noSum=True)),
        ("TeamColour", "string", dict(hidden=True)),
    ],
)

TABLES["UnsoldPlayers"] = dict(
    m=r'''
// Disconnected helper table for the "notable unsold" card: career IPL output of players nobody bought.
let
    UniqueOf = (variants as table) as table =>
        let G = Table.Group(variants, {"VKey"}, {{"N", each List.Count(List.Distinct([PlayerID])), Int64.Type}, {"PlayerID", each List.First([PlayerID]), type text}})
        in Table.SelectColumns(Table.SelectRows(G, each [N] = 1), {"VKey", "PlayerID"}),
    Lookup = Table.Distinct(Table.Combine({
        Table.RenameColumns(stg_NameFixes, {{"NameKey", "VKey"}}),
        UniqueOf(stg_IplVariants)}), {"VKey"}),
    // Exact (unique) or manual matches only: initials guesses mis-match common surnames.
    Matched = Table.ExpandTableColumn(Table.NestedJoin(stg_Unsold, {"NameKey"}, Lookup, {"VKey"}, "L", JoinKind.LeftOuter), "L", {"PlayerID"}),
    InitialsMatched = Table.RenameColumns(Matched, {{"PlayerID", "PlayerID2"}}),
    Career = Table.Group(stg_PlayerSeasonStats, {"PlayerID"}, {
        {"CareerMatches", each List.Sum([Matches]), Int64.Type},
        {"CareerImpact", each List.Sum([ImpactPoints]), Int64.Type},
        {"LastIplSeason", each List.Max([Season]), Int64.Type}}),
    WithCareer = Table.ExpandTableColumn(Table.NestedJoin(InitialsMatched, {"PlayerID2"}, Career, {"PlayerID"}, "C", JoinKind.LeftOuter), "C", {"CareerMatches", "CareerImpact", "LastIplSeason"}),
    Zeroed = Table.ReplaceValue(WithCareer, null, 0, Replacer.ReplaceValue, {"CareerMatches", "CareerImpact"}),
    Final = Table.SelectColumns(Zeroed, {"Season", "Player", "BasePriceCr", "CareerMatches", "CareerImpact", "LastIplSeason"})
in
    Final
''',
    columns=[
        ("Season", "int64", dict(noSum=True)),
        ("Player", "string", {}),
        ("BasePriceCr", "double", dict(fmt="#,0.00")),
        ("CareerMatches", "int64", {}),
        ("CareerImpact", "int64", {}),
        ("LastIplSeason", "int64", dict(noSum=True)),
    ],
)

TABLES["_Measures"] = dict(
    m=r'''
let
    Source = #table(type table [Measures = text], {})
in
    Source
''',
    columns=[("Measures", "string", dict(hidden=True))],
)

# --------------------------------------------------------------------------
# DAX measures: (name, folder, format, expression)
# --------------------------------------------------------------------------
CR = "₹#,0.0 Cr"
MEASURES = [
    # Money
    ("Spend Cr", "Money", CR, "SUM ( FactPlayerSeason[PriceCr] )"),
    ("Total Auction Spend Cr", "Money", CR, "SUM ( FactAuction[PriceCr] )"),
    ("Players Bought", "Money", "#,0", "COUNTROWS ( FactAuction )"),
    ("Avg Auction Price Cr", "Money", "₹#,0.00 Cr", "AVERAGE ( FactAuction[PriceCr] )"),
    ("Median Auction Price Cr", "Money", "₹#,0.00 Cr", "MEDIAN ( FactAuction[PriceCr] )"),
    ("Top Buy Price Cr", "Money", CR, "MAX ( FactAuction[PriceCr] )"),
    ("Top Buy Player", "Money", None, r'''
-- One name even when two buys share the top price (ties broken by the auction row key).
VAR mx = MAX ( FactAuction[PriceCr] )
VAR top1 = TOPN ( 1, FILTER ( FactAuction, FactAuction[PriceCr] = mx ), FactAuction[AuctionKey], ASC )
RETURN
    CONCATENATEX ( top1, RELATED ( DimPlayer[PlayerName] ) & " (" & FactAuction[TeamKey] & ")", ", " )
'''),
    ("Auction Premium %", "Money", "0%", r'''
VAR withBase = FILTER ( FactAuction, NOT ISBLANK ( FactAuction[BasePriceCr] ) )
VAR paid = SUMX ( withBase, FactAuction[PriceCr] )
VAR base = SUMX ( withBase, FactAuction[BasePriceCr] )
RETURN
    DIVIDE ( paid - base, base )
'''),
    ("Avg Price vs 2013", "Money", "0.0x", r'''
-- Average price in the latest season in context, as a multiple of the 2013 average.
VAR latest = MAX ( DimSeason[Season] )
RETURN
    DIVIDE (
        CALCULATE ( [Avg Auction Price Cr], REMOVEFILTERS ( DimSeason ), DimSeason[Season] = latest ),
        CALCULATE ( [Avg Auction Price Cr], REMOVEFILTERS ( DimSeason ), DimSeason[Season] = 2013 )
    )
'''),
    ("Mega 2025 vs 2013", "Money", "0.0x", r'''
DIVIDE (
    CALCULATE ( [Avg Auction Price Cr], REMOVEFILTERS ( DimSeason ), DimSeason[Season] = 2025 ),
    CALCULATE ( [Avg Auction Price Cr], REMOVEFILTERS ( DimSeason ), DimSeason[Season] = 2013 )
)
'''),
    ("Mega Auction Avg Price Cr", "Money", "₹#,0.00 Cr", r'''
IF ( SELECTEDVALUE ( DimSeason[IsMegaAuction] ) = TRUE (), [Avg Auction Price Cr] )
'''),
    ("Spend Matched %", "Money", "0.0%", r'''
DIVIDE (
    CALCULATE ( SUM ( FactAuction[PriceCr] ), FactAuction[IsMatched] = TRUE () ),
    SUM ( FactAuction[PriceCr] )
)
'''),
    ("Base Price Buys", "Money", "#,0", r'''CALCULATE ( COUNTROWS ( FactAuction ), FactAuction[PriceBracket] = "Base price buy" )'''),
    # Performance
    ("Impact Points", "Performance", "#,0", "SUM ( FactPlayerSeason[ImpactPoints] )"),
    ("Priced Impact", "Performance", "#,0", r'''CALCULATE ( [Impact Points], FactPlayerSeason[PriceSource] = "Auction" )'''),
    ("Player Matches", "Performance", "#,0", "SUM ( FactPlayerSeason[Matches] )"),
    ("Priced Matches", "Performance", "#,0", r'''CALCULATE ( [Player Matches], FactPlayerSeason[PriceSource] = "Auction" )'''),
    ("Runs", "Performance", "#,0", "SUM ( FactPlayerSeason[Runs] )"),
    ("Wickets", "Performance", "#,0", "SUM ( FactPlayerSeason[Wickets] )"),
    ("Catches", "Performance", "#,0", "SUM ( FactPlayerSeason[Catches] )"),
    ("Strike Rate", "Performance", "0.0", "DIVIDE ( [Runs], SUM ( FactPlayerSeason[BallsFaced] ) ) * 100"),
    ("Economy", "Performance", "0.00", "DIVIDE ( SUM ( FactPlayerSeason[RunsConceded] ), SUM ( FactPlayerSeason[LegalBalls] ) / 6 )"),
    ("Impact per Match", "Performance", "0.0", "DIVIDE ( [Impact Points], [Player Matches] )"),
    ("Top Run Scorer Runs", "Performance", "#,0", "MAXX ( VALUES ( DimPlayer[PlayerID] ), [Runs] )"),
    ("Top Run Scorer", "Performance", None, r'''
VAR best = [Top Run Scorer Runs]
RETURN
    CONCATENATEX ( FILTER ( VALUES ( DimPlayer[PlayerName] ), [Runs] = best ), DimPlayer[PlayerName], ", " )
'''),
    ("Top Wicket Taker Wickets", "Performance", "#,0", "MAXX ( VALUES ( DimPlayer[PlayerID] ), [Wickets] )"),
    ("Top Wicket Taker", "Performance", None, r'''
VAR best = [Top Wicket Taker Wickets]
RETURN
    CONCATENATEX ( FILTER ( VALUES ( DimPlayer[PlayerName] ), [Wickets] = best ), DimPlayer[PlayerName], ", " )
'''),
    # Value
    ("Lakh per Point", "Value", "#,0.00", "DIVIDE ( [Spend Cr] * 100, [Priced Impact] )"),
    ("League Spend", "Value", CR, r'''
CALCULATE ( [Spend Cr], ALL ( FactPlayerSeason ), VALUES ( DimSeason[Season] ) )
'''),
    ("League Priced Impact", "Value", "#,0", r'''
CALCULATE ( [Priced Impact], ALL ( FactPlayerSeason ), VALUES ( DimSeason[Season] ) )
'''),
    ("Value Index", "Value", "0.00", r'''
-- Share of the league's priced impact divided by share of the league's spend,
-- computed season by season so each season is judged against its own market.
-- 1.00 = fair value, above 1 = more output than the money suggests.
VAR bySeason =
    ADDCOLUMNS (
        VALUES ( DimSeason[Season] ),
        "@impShare", DIVIDE ( [Priced Impact], [League Priced Impact] ),
        "@spendShare", DIVIDE ( [Spend Cr], [League Spend] )
    )
RETURN
    DIVIDE ( SUMX ( bySeason, [@impShare] ), SUMX ( bySeason, [@spendShare] ) )
'''),
    ("Fair Value Cr", "Value", CR, r'''
-- What the output would have cost at that season's league price per Impact Point.
SUMX (
    VALUES ( DimSeason[Season] ),
    DIVIDE ( [Priced Impact] * [League Spend], [League Priced Impact] )
)
'''),
    ("Overpay Cr", "Value", CR, "IF ( NOT ISBLANK ( [Spend Cr] ), [Spend Cr] - [Fair Value Cr] )"),
    ("Surplus Cr", "Value", CR, "IF ( NOT ISBLANK ( [Spend Cr] ), [Fair Value Cr] - [Spend Cr] )"),
    ("Value Index (min 5 matches)", "Value", "0.00", "IF ( [Priced Matches] >= 5, [Value Index] )"),
    ("Value Quadrant Label", "Value", None, r'''
IF ( HASONEVALUE ( FactPlayerSeason[Value Quadrant] ), VALUES ( FactPlayerSeason[Value Quadrant] ),
    CONCATENATEX ( VALUES ( FactPlayerSeason[Value Quadrant] ), FactPlayerSeason[Value Quadrant], ", " ) )
'''),
    ("Bargain XI Flag", "Value", "0", r'''
-- 1 when the player is in the Bargain XI: top Value Index per role (4 batters, 1 keeper, 2 all-rounders, 4 bowlers), min 5 priced matches.
VAR thisPlayer = SELECTEDVALUE ( DimPlayer[PlayerID] )
VAR thisRole = SELECTEDVALUE ( DimPlayer[Role] )
VAR slots = SWITCH ( thisRole, "Batter", 4, "Wicket-Keeper", 1, "All-Rounder", 2, "Bowler", 4, 0 )
VAR eligible =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS ( VALUES ( DimPlayer[PlayerID] ), "@vi", [Value Index], "@m", [Priced Matches] ),
            [@m] >= 5 && NOT ISBLANK ( [@vi] )
        ),
        ALLSELECTED ( DimPlayer ),
        DimPlayer[Role] = thisRole
    )
VAR picked = TOPN ( slots, eligible, [@vi], DESC )
RETURN
    IF ( NOT ISBLANK ( thisPlayer ) && thisPlayer IN SELECTCOLUMNS ( picked, "id", DimPlayer[PlayerID] ), 1 )
'''),
    ("Overpaid XI Flag", "Value", "0", r'''
-- 1 when the player is in the Overpaid XI: largest Overpay Cr per role, min 5 priced matches.
VAR thisPlayer = SELECTEDVALUE ( DimPlayer[PlayerID] )
VAR thisRole = SELECTEDVALUE ( DimPlayer[Role] )
VAR slots = SWITCH ( thisRole, "Batter", 4, "Wicket-Keeper", 1, "All-Rounder", 2, "Bowler", 4, 0 )
VAR eligible =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS ( VALUES ( DimPlayer[PlayerID] ), "@over", [Overpay Cr], "@m", [Priced Matches] ),
            [@m] >= 5 && [@over] > 0
        ),
        ALLSELECTED ( DimPlayer ),
        DimPlayer[Role] = thisRole
    )
VAR picked = TOPN ( slots, eligible, [@over], DESC )
RETURN
    IF ( NOT ISBLANK ( thisPlayer ) && thisPlayer IN SELECTCOLUMNS ( picked, "id", DimPlayer[PlayerID] ), 1 )
'''),
    ("Teams Played For", "Value", None, r'''
CONCATENATEX ( VALUES ( FactPlayerSeason[TeamKey] ), FactPlayerSeason[TeamKey], ", ", FactPlayerSeason[TeamKey], ASC )
'''),
    ("Career Value Index", "Value", "0.00", "CALCULATE ( [Value Index], REMOVEFILTERS ( DimSeason ) )"),
    ("Selected Season Label", "Value", None, r'''
VAR mn = MIN ( DimSeason[Season] )
VAR mx = MAX ( DimSeason[Season] )
RETURN
    IF ( mn = mx, "IPL " & mn, "IPL " & mn & "–" & mx )
'''),
    ("Unsold Card Text", "Value", None, r'''
VAR top5 = TOPN ( 5, FILTER ( UnsoldPlayers, UnsoldPlayers[CareerImpact] > 0 ), UnsoldPlayers[CareerImpact], DESC )
RETURN
    CONCATENATEX ( top5, UnsoldPlayers[Player] & " (" & FORMAT ( UnsoldPlayers[CareerImpact], "#,0" ) & " pts)", UNICHAR ( 10 ), UnsoldPlayers[CareerImpact], DESC )
'''),
    ("Player Seasons", "Value", "#,0", "COUNTROWS ( FactPlayerSeason )"),
    ("Median Priced Price Cr", "Value", "₹#,0.00 Cr", """
CALCULATE ( MEDIAN ( FactPlayerSeason[PriceCr] ), ALL ( FactPlayerSeason ), VALUES ( DimSeason[Season] ), FactPlayerSeason[PriceSource] = "Auction" )
"""),
    ("Median Priced Impact", "Value", "#,0", """
CALCULATE ( MEDIAN ( FactPlayerSeason[ImpactPoints] ), ALL ( FactPlayerSeason ), VALUES ( DimSeason[Season] ), FactPlayerSeason[PriceSource] = "Auction" )
"""),
    ("Above Median Impact %", "Value", "0%", """
-- Share of priced player-seasons whose Impact Points beat that season's median.
VAR priced = FILTER ( FactPlayerSeason, FactPlayerSeason[PriceSource] = "Auction" )
RETURN
    DIVIDE ( COUNTROWS ( FILTER ( priced, FactPlayerSeason[ImpactPoints] >= FactPlayerSeason[MedianImpact] ) ), COUNTROWS ( priced ) )
"""),
    ("Overpay Cr (min 5 matches)", "Value", "₹#,0.0 Cr", "IF ( [Priced Matches] >= 5, [Overpay Cr] )"),
    ("Steal Rank", "Value", "0", """
VAR vi = [Value Index (min 5 matches)]
RETURN
    IF (
        ISBLANK ( vi ), 999,
        RANKX ( FILTER ( ALLSELECTED ( DimPlayer[PlayerName] ), NOT ISBLANK ( [Value Index (min 5 matches)] ) ), [Value Index (min 5 matches)], vi, DESC, SKIP )
    )
"""),
    ("Overpaid Rank", "Value", "0", """
VAR o = [Overpay Cr (min 5 matches)]
RETURN
    IF (
        ISBLANK ( o ) || o <= 0, 999,
        RANKX ( FILTER ( ALLSELECTED ( DimPlayer[PlayerName] ), [Overpay Cr (min 5 matches)] > 0 ), [Overpay Cr (min 5 matches)], o, DESC, SKIP )
    )
"""),
    ("Base Price Value Index", "Value", "0.00", 'CALCULATE ( [Value Index], FactPlayerSeason[PriceBracket] = "Base price buy" )'),
    ("Marquee Value Index", "Value", "0.00", 'CALCULATE ( [Value Index], FactPlayerSeason[PriceBracket] = "10 Cr and above" )'),
    ("Marquee Above Median %", "Value", "0%", 'CALCULATE ( [Above Median Impact %], FactPlayerSeason[PriceBracket] = "10 Cr and above" )'),
    ("Base Price Above Median %", "Value", "0%", 'CALCULATE ( [Above Median Impact %], FactPlayerSeason[PriceBracket] = "Base price buy" )'),
    ("Overseas Price Premium %", "Money", "0%", """
DIVIDE (
    CALCULATE ( [Avg Auction Price Cr], DimPlayer[Nationality] = "Overseas" ),
    CALCULATE ( [Avg Auction Price Cr], DimPlayer[Nationality] = "Indian" )
) - 1
"""),
    ("Overseas Value Index", "Value", "0.00", 'CALCULATE ( [Value Index], DimPlayer[Nationality] = "Overseas" )'),
    ("Indian Value Index", "Value", "0.00", 'CALCULATE ( [Value Index], DimPlayer[Nationality] = "Indian" )'),
    ("Selected Player", "Value", None, 'SELECTEDVALUE ( DimPlayer[PlayerName], "Select a player" )'),
    ("Selected Role", "Value", None, "SELECTEDVALUE ( DimPlayer[Role] )"),
    ("Selected Nationality", "Value", None, "SELECTEDVALUE ( DimPlayer[Nationality] )"),
    ("Career Spend Cr", "Money", "₹#,0.0 Cr", "CALCULATE ( [Spend Cr], REMOVEFILTERS ( DimSeason ) )"),
    ("Unsold Career Impact", "Value", "#,0", "SUM ( UnsoldPlayers[CareerImpact] )"),
    ("Unsold Rank", "Value", "0", "RANKX ( ALL ( UnsoldPlayers[Player] ), [Unsold Career Impact], , DESC, SKIP )"),
    ("Season Bar Colour", "Formatting", None, 'IF ( SELECTEDVALUE ( DimSeason[IsMegaAuction] ) = TRUE (), "#262626", "#F2C94C" )'),
    ("Spend Bar Colour", "Formatting", None, '"#F2C94C"'),
    ("Team Colour", "Formatting", None, 'SELECTEDVALUE ( DimTeam[TeamColour], "#94A3B8" )'),
    ("Team Season Colour", "Formatting", None, 'SELECTEDVALUE ( DimTeamSeason[TeamColour], "#94A3B8" )'),
    ("Lakh per Point Colour", "Formatting", None, """
-- Green when cheaper than the league rate for the same seasons, red when dearer.
VAR lpp = [Lakh per Point]
VAR league = DIVIDE ( [League Spend] * 100, [League Priced Impact] )
VAR ratio = DIVIDE ( lpp, league )
RETURN
    SWITCH ( TRUE (), ISBLANK ( lpp ), "#FFFFFF", ratio <= 0.8, "#D7F0DE", ratio >= 1.25, "#FADADB", "#FFFFFF" )
"""),
    ("Steal Colour", "Formatting", None, 'IF ( [Value Index (min 5 matches)] >= 2, "#BFE6CB", "#D7F0DE" )'),
    ("Overpaid Colour", "Formatting", None, 'IF ( [Overpay Cr] >= 5, "#F6C3C5", "#FADADB" )'),
    ("Quadrant Colour", "Formatting", None, 'SWITCH ( SELECTEDVALUE ( FactPlayerSeason[Value Quadrant] ), "Steal", "#D7F0DE", "Star", "#FCF0C8", "Overpaid", "#FADADB", "Passenger", "#EEEEEE", "#FFFFFF" )'),
    ("Steal Count", "Value", "#,0", 'CALCULATE ( COUNTROWS ( FactPlayerSeason ), FactPlayerSeason[Value Quadrant] = "Steal" )'),
    ("Overpaid Count", "Value", "#,0", 'CALCULATE ( COUNTROWS ( FactPlayerSeason ), FactPlayerSeason[Value Quadrant] = "Overpaid" )'),
    ("Priced Player Seasons", "Value", "#,0", 'CALCULATE ( COUNTROWS ( FactPlayerSeason ), FactPlayerSeason[PriceSource] = "Auction" )'),
    ("Top Steal Label", "Value", None, """
VAR t =
    TOPN ( 1,
        FILTER ( ADDCOLUMNS ( VALUES ( DimPlayer[PlayerName] ), "@v", [Value Index (min 5 matches)] ), NOT ISBLANK ( [@v] ) ),
        [@v], DESC )
RETURN
    CONCATENATEX ( t, DimPlayer[PlayerName] & " · " & FORMAT ( [@v], "0.0" ) & "×", ", " )
"""),
    ("Most Overpaid Label", "Value", None, """
VAR t =
    TOPN ( 1,
        FILTER ( ADDCOLUMNS ( VALUES ( DimPlayer[PlayerName] ), "@o", [Overpay Cr (min 5 matches)] ), [@o] > 0 ),
        [@o], DESC )
RETURN
    CONCATENATEX ( t, DimPlayer[PlayerName] & " · ₹" & FORMAT ( [@o], "0.0" ) & " Cr", ", " )
"""),
    ("Best Team Label", "Value", None, """
VAR t =
    TOPN ( 1,
        FILTER ( ADDCOLUMNS ( VALUES ( DimTeam[ShortCode] ), "@v", [Value Index] ), NOT ISBLANK ( [@v] ) ),
        [@v], DESC )
RETURN
    CONCATENATEX ( t, DimTeam[ShortCode] & " · " & FORMAT ( [@v], "0.00" ), ", " )
"""),
    ("Worst Team Label", "Value", None, """
VAR t =
    TOPN ( 1,
        FILTER ( ADDCOLUMNS ( VALUES ( DimTeam[ShortCode] ), "@v", [Value Index] ), NOT ISBLANK ( [@v] ) ),
        [@v], ASC )
RETURN
    CONCATENATEX ( t, DimTeam[ShortCode] & " · " & FORMAT ( [@v], "0.00" ), ", " )
"""),
    ("Best Role Label", "Value", None, """
VAR t =
    TOPN ( 1,
        FILTER (
            ADDCOLUMNS ( FILTER ( VALUES ( DimPlayer[Role] ), DimPlayer[Role] <> "Unknown" ), "@v", [Value Index] ),
            NOT ISBLANK ( [@v] ) ),
        [@v], DESC )
RETURN
    CONCATENATEX ( t, DimPlayer[Role] & " · " & FORMAT ( [@v], "0.00" ), ", " )
"""),
    ("Players In Data", "QA", "#,0", "COUNTROWS ( DimPlayer )"),
    ("Seasons Covered", "QA", "#,0", "DISTINCTCOUNT ( FactTeamMatch[Season] )"),
    ("QA 2026 Buys", "QA", "#,0", "CALCULATE ( [Players Bought], DimSeason[Season] = 2026 )"),
    ("QA 2026 Spend Cr", "QA", "₹#,0.00 Cr", "CALCULATE ( [Total Auction Spend Cr], DimSeason[Season] = 2026 )"),
    # Team
    ("Team Wins", "Team", "#,0", "SUM ( FactTeamMatch[Won] )"),
    ("Team Results", "Team", "#,0", "COUNTROWS ( FactTeamMatch ) - SUM ( FactTeamMatch[NoResult] )"),
    ("Win %", "Team", "0%", "DIVIDE ( [Team Wins], [Team Results] )"),
    ("Team Spend Cr", "Team", CR, "[Spend Cr]"),
    # QA
    ("QA Matches", "QA", "#,0", "DISTINCTCOUNT ( FactTeamMatch[MatchID] )"),
    ("QA League Value Index", "QA", "0.00", "CALCULATE ( [Value Index], REMOVEFILTERS ( DimTeam ), REMOVEFILTERS ( DimPlayer ) )"),
    ("QA Bad Prices", "QA", "#,0", "0 + COUNTROWS ( FILTER ( FactAuction, ISBLANK ( FactAuction[PriceCr] ) || FactAuction[PriceCr] <= 0 ) )"),
    ("QA Team Keys", "QA", None, r'''
CONCATENATEX ( FILTER ( VALUES ( DimTeam[TeamKey] ), CALCULATE ( COUNTROWS ( FactPlayerSeason ) ) + CALCULATE ( COUNTROWS ( FactAuction ) ) > 0 ), DimTeam[TeamKey], ", ", DimTeam[TeamKey], ASC )
'''),
    ("QA Unmapped Team Rows", "QA", "#,0", r'''
0 + COUNTROWS ( FILTER ( FactAuction, ISBLANK ( FactAuction[TeamKey] ) ) ) + COUNTROWS ( FILTER ( FactTeamMatch, ISBLANK ( FactTeamMatch[TeamKey] ) ) )
'''),
    ("QA Avg Win %", "QA", "0.0%", "AVERAGEX ( VALUES ( DimTeam[TeamKey] ), [Win %] )"),
    ("QA Contract Rows Beyond Mega", "QA", "#,0", r'''
-- Contract rows that run past the season before the next mega auction (should be 0).
0 + COUNTROWS (
    FILTER (
        FactPlayerSeason,
        FactPlayerSeason[PriceSource] = "Auction"
            && FactPlayerSeason[Season] > SWITCH ( TRUE (),
                FactPlayerSeason[AuctionSeason] < 2014, 2013,
                FactPlayerSeason[AuctionSeason] < 2018, 2017,
                FactPlayerSeason[AuctionSeason] < 2022, 2021,
                FactPlayerSeason[AuctionSeason] < 2025, 2024,
                2026 )
    )
)
'''),
]

RELATIONSHIPS = [
    ("FactPlayerSeason", "PlayerID", "DimPlayer", "PlayerID"),
    ("FactPlayerSeason", "TeamKey", "DimTeam", "TeamKey"),
    ("FactPlayerSeason", "Season", "DimSeason", "Season"),
    ("FactAuction", "PlayerID", "DimPlayer", "PlayerID"),
    ("FactAuction", "TeamKey", "DimTeam", "TeamKey"),
    ("FactAuction", "Season", "DimSeason", "Season"),
    ("FactTeamMatch", "TeamKey", "DimTeam", "TeamKey"),
    ("FactTeamMatch", "Season", "DimSeason", "Season"),
    ("FactPlayerSeason", "TeamSeasonKey", "DimTeamSeason", "TeamSeasonKey"),
    ("FactTeamMatch", "TeamSeasonKey", "DimTeamSeason", "TeamSeasonKey"),
]


def q(name):
    return f"'{name}'" if any(c in name for c in " -%()&/.'") or not name.replace("_", "a").isalnum() else name


def multiline_expr(expr, depth):
    """TMDL fenced expression; the fence lines sit at the property depth + 1."""
    body = ind(expr.strip("\n"), depth)
    return "```\n" + body + "\n" + "\t" * depth + "```"


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text.rstrip("\n") + "\n")


def table_tmdl(name, spec):
    lines = [f"table {q(name)}", f"\tlineageTag: {tag('table', name)}", ""]
    if name == "_Measures":
        for mname, folder, fmt, expr in MEASURES:
            expr = expr.strip("\n")
            if "\n" in expr:
                lines.append(f"\tmeasure {q(mname)} = " + multiline_expr(expr, 3))
            else:
                lines.append(f"\tmeasure {q(mname)} = {expr}")
            if fmt:
                lines.append(f"\t\tformatString: {fmt}")
            lines.append(f"\t\tdisplayFolder: {folder}")
            lines.append(f"\t\tlineageTag: {tag('measure', mname)}")
            lines.append("")
    for cname, dtype, opts in spec["columns"]:
        lines.append(f"\tcolumn {q(cname)}")
        lines.append(f"\t\tdataType: {dtype}")
        if opts.get("fmt"):
            lines.append(f"\t\tformatString: {opts['fmt']}")
        elif dtype == "int64":
            lines.append("\t\tformatString: 0")
        if opts.get("hidden"):
            lines.append("\t\tisHidden")
        lines.append(f"\t\tlineageTag: {tag('column', name, cname)}")
        summ = "none" if (dtype not in ("int64", "double") or opts.get("hidden") or opts.get("noSum") or cname in ("Season",)) else "sum"
        lines.append(f"\t\tsummarizeBy: {summ}")
        lines.append(f"\t\tsourceColumn: {cname}")
        if opts.get("sortBy"):
            lines.append(f"\t\tsortByColumn: {q(opts['sortBy'])}")
        lines.append("")
        lines.append("\t\tannotation SummarizationSetBy = User")
        lines.append("")
    for cname, dtype, expr, opts in spec.get("calc_columns", []):
        lines.append(f"\tcolumn {q(cname)} = " + multiline_expr(expr, 3))
        lines.append(f"\t\tdataType: {dtype}")
        if dtype == "int64":
            lines.append("\t\tformatString: 0")
        if opts.get("hidden"):
            lines.append("\t\tisHidden")
        lines.append(f"\t\tlineageTag: {tag('column', name, cname)}")
        lines.append("\t\tsummarizeBy: none")
        if opts.get("sortBy"):
            lines.append(f"\t\tsortByColumn: {q(opts['sortBy'])}")
        lines.append("")
        lines.append("\t\tannotation SummarizationSetBy = User")
        lines.append("")
    lines.append(f"\tpartition {q(name)} = m")
    lines.append("\t\tmode: import")
    lines.append("\t\tqueryGroup: Model")
    lines.append("\t\tsource =")
    lines.append(ind(spec["m"], 4))
    lines.append("")
    lines.append("\tannotation PBI_ResultType = Table")
    if name == "_Measures":
        lines.append("")
        lines.append("\tannotation PBI_NavigationStepName = Navigation")
    return "\n".join(lines)


def expression_block(name, body, group, result_type, param=False):
    if param:
        head = f"expression {name} = {body}"
        out = [head]
    else:
        out = [f"expression {name} =", ind(body, 2)]
    out += [f"\tlineageTag: {tag('expr', name)}", f"\tqueryGroup: {group}", "",
            f"\tannotation PBI_ResultType = {result_type}", ""]
    if result_type == "Function":
        out.insert(-2, "\tannotation PBI_NavigationStepName = Navigation")
        out.insert(-2, "")
    return "\n".join(out)


def build():
    d = os.path.join(SM, "definition")
    # Regenerate the definition only; keep Desktop's .pbi folder (local settings and data cache).
    if os.path.isdir(d):
        shutil.rmtree(d)
    write(os.path.join(SM, "definition.pbism"), json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
        "version": "4.2", "settings": {}}, indent=2))
    write(os.path.join(SM, ".platform"), json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "SemanticModel", "displayName": NAME},
        "config": {"version": "2.0", "logicalId": tag("logical", "sm")}}, indent=2))
    write(os.path.join(d, "database.tmdl"), "database\n\tcompatibilityLevel: 1600\n")

    exprs = []
    for n, (body, rt) in PARAMS.items():
        exprs.append(expression_block(n, body, "Parameters", rt, param=True))
    for n, body in FUNCTIONS.items():
        exprs.append(expression_block(n, body, "Functions", "Function"))
    for n, body in STAGING.items():
        rt = "Record" if n == "stg_TeamLookup" else "Table"
        exprs.append(expression_block(n, body, "Staging", rt))
    write(os.path.join(d, "expressions.tmdl"), "\n".join(exprs))

    order = list(PARAMS) + list(FUNCTIONS) + list(STAGING) + list(TABLES)
    model = [
        "model Model",
        "\tculture: en-US",
        "\tdefaultPowerBIDataSourceVersion: powerBI_V3",
        "\tdiscourageImplicitMeasures",
        "\tsourceQueryCulture: en-IN",
        "\tdataAccessOptions",
        "\t\tlegacyRedirects",
        "\t\treturnErrorValuesAsNull",
        "",
    ]
    for i, g in enumerate(["Parameters", "Functions", "Staging", "Model"]):
        model += [f"queryGroup {g}", "", f"\tannotation PBI_QueryGroupOrder = {i}", ""]
    model += [
        "annotation __PBI_TimeIntelligenceEnabled = 0", "",
        f"annotation PBI_QueryOrder = {json.dumps(order)}", "",
        'annotation PBI_ProTooling = ["DevMode"]', "",
    ]
    model += [f"ref table {q(t)}" for t in TABLES]
    write(os.path.join(d, "model.tmdl"), "\n".join(model))

    for t, spec in TABLES.items():
        write(os.path.join(d, "tables", f"{t}.tmdl"), table_tmdl(t, spec))

    rel = []
    for ft, fc, tt, tc in RELATIONSHIPS:
        rel += [f"relationship {tag('rel', ft, fc, tt)}", f"\tfromColumn: {q(ft)}.{q(fc)}", f"\ttoColumn: {q(tt)}.{q(tc)}", ""]
    write(os.path.join(d, "relationships.tmdl"), "\n".join(rel))
    print("semantic model written to", SM)


if __name__ == "__main__":
    build()
