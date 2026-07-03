namespace Sport4You.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public Guid? ActiveAvatarId { get; set; }
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}
