import PublicProfilePage from "@/components/public-profile-page";

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({ params }: { params: { userId: string } }) {
    return (
        <PublicProfilePage userId={params.userId} />
    )
}
