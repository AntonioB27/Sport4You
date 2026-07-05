namespace Sport4You.Api.DTOs;

public record RivalDto(Guid? RivalUserId);

public record RivalStatusDto(
    Guid UserId, string FirstName, string LastName,
    string? ImagePath, string? BorderCss,
    int MyPoints, int RivalPoints, int PointsGap,
    bool ImAhead, bool JustFlipped);

public record SetRivalRequest(Guid RivalUserId);
