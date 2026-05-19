import PublicProfilePage from "@/components/public-profile-page";

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params;
    return (
        <PublicProfilePage userId={userId} />
    );
}
