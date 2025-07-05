import { ProtectedRoute } from "@/components/auth/protected-route";
import ProfileClientPage from "@/components/profile-client-page";

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileClientPage />
        </ProtectedRoute>
    )
}
