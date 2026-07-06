using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IPersonalRecordsService
{
    Task<PersonalRecordsDto> GetRecordsAsync(Guid userId);
}
