import { getCompanyById } from '@/lib/actions/companies';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Landmark, Users, DollarSign, LineChart, Briefcase, Percent } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InvestDialog } from '@/components/invest-dialog';

function getInitials(name: string) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default async function CompanyDetailPage({ params }: { params: { companyId: string } }) {
  const companyId = parseInt(params.companyId, 10);
  if (isNaN(companyId)) {
    notFound();
  }

  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }
  
  const marketCap = company.sharePrice * company.totalShares;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground">{company.description}</p>
        </div>
        <InvestDialog company={company}>
            <Button>Investir</Button>
        </InvestDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trésorerie</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">${company.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <p className="text-xs text-muted-foreground">Fonds gérés par l'entreprise</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prix de l'Action</CardTitle>
                  <LineChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">${company.sharePrice.toFixed(2)}</div>
                   <p className="text-xs text-muted-foreground">Prix par part de l'entreprise</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Capitalisation Boursière</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">${marketCap.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                   <p className="text-xs text-muted-foreground">Valeur totale de l'entreprise</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Membres</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{company.members.length}</div>
                  <p className="text-xs text-muted-foreground">Personnes gérant l'entreprise</p>
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Actionnaires</CardTitle>
                <CardDescription>Investisseurs détenant des parts de {company.name}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Investisseur</TableHead>
                            <TableHead className="text-right">Parts</TableHead>
                            <TableHead className="text-right">Propriété (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {company.shares.length > 0 ? company.shares.map(share => (
                            <TableRow key={share.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{getInitials(share.user.displayName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{share.user.displayName}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{share.quantity.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                                <TableCell className="text-right font-mono">{((share.quantity / company.totalShares) * 100).toFixed(4)}%</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    Personne n'a encore investi dans cette entreprise.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Membres de l'Équipe</CardTitle>
                <CardDescription>Liste des membres et de leurs rôles au sein de {company.name}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Membre</TableHead>
                            <TableHead>Rôle</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {company.members.length > 0 ? company.members.map(member => (
                            <TableRow key={member.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{getInitials(member.user.displayName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{member.user.displayName}</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{member.role.toUpperCase()}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="ghost" size="sm">
                                        <Link href={`/users/${member.userId}`}>Voir le Profil</Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    Cette entreprise n'a pas encore de membres.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
