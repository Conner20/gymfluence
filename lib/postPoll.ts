export type PostTypeValue = "STANDARD" | "POLL";

export type PollOptionResult = {
    id: string;
    text: string;
    voteCount: number;
    percentage: number;
    isSelected: boolean;
};

export type PostPollData = {
    question: string;
    totalVotes: number;
    viewerHasVoted: boolean;
    viewerOptionId: string | null;
    options: PollOptionResult[];
};

type PollOptionWithVotes = {
    id: string;
    text: string;
    order: number;
    votes: Array<{ userId: string }>;
};

export function buildPollPayload({
    question,
    options,
    viewerId,
}: {
    question: string;
    options: PollOptionWithVotes[];
    viewerId: string | null;
}): PostPollData {
    const sortedOptions = [...options].sort((a, b) => a.order - b.order);
    const totalVotes = sortedOptions.reduce((sum, option) => sum + option.votes.length, 0);
    const selectedOption = viewerId
        ? sortedOptions.find((option) => option.votes.some((vote) => vote.userId === viewerId))
        : null;

    return {
        question,
        totalVotes,
        viewerHasVoted: !!selectedOption,
        viewerOptionId: selectedOption?.id ?? null,
        options: sortedOptions.map((option) => {
            const voteCount = option.votes.length;
            return {
                id: option.id,
                text: option.text,
                voteCount,
                percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0,
                isSelected: selectedOption?.id === option.id,
            };
        }),
    };
}
