# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first (layer caches on unchanged csproj)
COPY Sport4You.Api/Sport4You.Api.csproj Sport4You.Api/
RUN dotnet restore Sport4You.Api/Sport4You.Api.csproj

# Build & publish
COPY Sport4You.Api/ Sport4You.Api/
RUN dotnet publish Sport4You.Api/Sport4You.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# The SQLite file lives on a mounted volume; make it writable by the
# image's non-root `app` user (Docker seeds a fresh named volume with
# this directory's ownership on first mount).
RUN mkdir -p /data && chown app:app /data
USER app

ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__Default="Data Source=/data/sport4you.db"
EXPOSE 8080

ENTRYPOINT ["dotnet", "Sport4You.Api.dll"]
