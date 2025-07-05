import PublicProfilePage from "@/components/public-profile-page";

export default function UserProfilePage({ params }: { params: { userId: string } }) {
    return (
        <PublicProfilePage userId={params.userId} />
    )
}
