import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

const client = new S3Client({
    endpoint: "https://sgp1.digitaloceanspaces.com",
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!,
    },
    forcePathStyle: false,
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
        return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: "kmp-katana-backup",
            Key: key,
        });

        const response = await client.send(command);

        if (!response.Body) {
            return NextResponse.json({ error: "Empty response" }, { status: 500 });
        }

        // Get the original filename and change .dmp to .sql
        const originalName = key.split("/").pop() || "download";
        const downloadName = originalName.replace(/\.dmp$/, ".sql");

        // Stream the response body
        const stream = response.Body.transformToWebStream();

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "application/sql",
                "Content-Disposition": `attachment; filename="${downloadName}"`,
                "Content-Length": response.ContentLength?.toString() || "",
            },
        });
    } catch (error) {
        console.error("Download Error:", error);
        return NextResponse.json(
            { error: "Failed to download file" },
            { status: 500 }
        );
    }
}
