import { getCompaniesForUserDashboard } from '@/lib/actions/companies';
import { CompaniesClientPage } from '@/components/companies-client-page';


export default async function CompaniesPage() {
    const { managedCompanies, investedCompanies, otherPrivateCompanies, listedCompanies } = await getCompaniesForUserDashboard();
    
    return <CompaniesClientPage 
              managedCompanies={managedCompanies} 
              investedCompanies={investedCompanies} 
              otherPrivateCompanies={otherPrivateCompanies}
              listedCompanies={listedCompanies}
           />;
}
