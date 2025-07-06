import { getCompanies } from '@/lib/actions/companies';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCompanyDialog } from '@/components/create-company-dialog';
import { Button } from '@/components/ui/button';

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Entreprises</CardTitle>
          <CardDescription>Créez ou investissez dans des entreprises, influencez la gestion et gagnez des dividendes.</CardDescription>
        </div>
        <CreateCompanyDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Industrie</TableHead>
              <TableHead>Trésorerie</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length > 0 ? (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="font-medium">{company.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{company.industry}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">${parseFloat(company.cash).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm">Détails</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Aucune entreprise n'a encore été créée. Soyez le premier !
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
