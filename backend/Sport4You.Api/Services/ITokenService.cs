using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public interface ITokenService
{
    string CreateToken(User user);
}
