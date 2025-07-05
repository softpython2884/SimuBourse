import { ProtectedRoute } from "@/components/auth/protected-route";
import PortfolioClientPage from "@/components/portfolio-client-page";

export default function PortfolioPage() {
    return (
        <ProtectedRoute>
            <PortfolioClientPage />
        </ProtectedRoute>
    )
}
