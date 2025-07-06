import { getCompaniesForUserDashboard } from '@/lib/actions/companies';
import { CompaniesClientPage } from '@/components/companies-client-page';


export default async function CompaniesPage() {
    const { managedCompanies, investedCompanies, otherCompanies } = await getCompaniesForUserDashboard();
    
    return <CompaniesClientPage 
              managedCompanies={managedCompanies} 
              investedCompanies={investedCompanies} 
              otherCompanies={otherCompanies} 
           />;
}
