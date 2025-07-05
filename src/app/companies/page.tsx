import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const companies = [
  { name: 'Innovatech AI', ticker: 'INVT', industry: 'Technologie', sharePrice: '$150.25', marketCap: '$1.5B', dividend: '$2.50/action' },
  { name: 'EcoPower Grids', ticker: 'EPG', industry: 'Énergie', sharePrice: '$78.50', marketCap: '$785M', dividend: '$1.10/action' },
  { name: 'QuantumLeap Gaming', ticker: 'QLG', industry: 'Divertissement', sharePrice: '$210.00', marketCap: '$2.1B', dividend: 'N/A' },
  { name: 'BioSynth Pharma', ticker: 'BSP', industry: 'Santé', sharePrice: '$325.75', marketCap: '$3.2B', dividend: '$5.00/action' },
];

export default function CompaniesPage() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Entreprises</CardTitle>
          <CardDescription>Créez ou investissez dans des entreprises, influencez la gestion et gagnez des dividendes.</CardDescription>
        </div>
        <Button>Créer une nouvelle entreprise</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Industrie</TableHead>
              <TableHead>Prix de l'action</TableHead>
              <TableHead>Cap. Boursière</TableHead>
              <TableHead>Dividende</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.ticker}>
                <TableCell>
                  <div className="font-medium">{company.name}</div>
                  <div className="text-sm text-muted-foreground">{company.ticker}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{company.industry}</Badge>
                </TableCell>
                <TableCell className="font-mono">{company.sharePrice}</TableCell>
                <TableCell>{company.marketCap}</TableCell>
                <TableCell>{company.dividend}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm">Détails</Button>
                  <Button variant="default" size="sm">Acheter des Actions</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
