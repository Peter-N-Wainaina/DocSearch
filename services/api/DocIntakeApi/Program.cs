using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Amazon.S3;
using Amazon.S3.Model;

var builder = WebApplication.CreateBuilder(args);

// Add AWS S3 service
builder.Services.AddAWSService<IAmazonS3>();

// Add CORS for frontend access
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173") // Vite and other dev servers
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Enable CORS
app.UseCors("AllowFrontend");

// Health check endpoint
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// Presigned URL endpoint
app.MapPost("/presign", async (PresignRequest request, IAmazonS3 s3Client) =>
{
    try
    {
        // Validate request
        if (string.IsNullOrEmpty(request.FileName))
            return Results.BadRequest("File name is required");

        if (request.FileSize <= 0)
            return Results.BadRequest("File size must be greater than 0");

        // Generate unique key for the file
        var key = $"uploads/{Guid.NewGuid()}-{request.FileName}";
        
        // TODO: Get bucket name from configuration
        var bucketName = "doc-intake-uploads-dev"; // Replace with your actual bucket name
        
        // Create presigned URL request
        var presignedRequest = new GetPreSignedUrlRequest
        {
            BucketName = bucketName,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = DateTime.UtcNow.AddMinutes(15), // 15 minute expiry
            ContentType = request.FileType
        };

        // Generate presigned URL
        var presignedUrl = await s3Client.GetPreSignedURLAsync(presignedRequest);

        return Results.Ok(new PresignResponse
        (
            presignedUrl,
            key,
            bucketName,
            DateTime.UtcNow.AddMinutes(15)
        ));
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error generating presigned URL: {ex.Message}");
    }
});

app.Run();

// Request/Response models
public record PresignRequest(
    string FileName,
    string FileType,
    long FileSize
);

public record PresignResponse(
    string PresignedUrl,
    string Key,
    string BucketName,
    DateTime ExpiresAt
);
