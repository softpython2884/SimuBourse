import { getCompanyById } from '@/lib/actions/companies';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Landmark, Users, DollarSign, LineChart, Briefcase, Percent, Package, Cpu, Settings, Server, Bitcoin, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InvestDialog } from '@/components/invest-dialog';
import { getSession } from '@/lib/session';
import { ManageCompanyAssetsDialog } from '@/components/manage-company-assets-dialog';
import { AddCompanyCashDialog } from '@/components/add-company-cash-dialog';
import { getRigById } from '@/lib/mining';
import { ManageMembersDialog } from '@/components/manage-members-dialog';
import { WithdrawCompanyCashDialog } from '@/components/withdraw-company-cash-dialog';
import { ListCompanyButton } from '@/components/list-company-button';
import { ClaimBtcButton } from '@/components/claim-btc-button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


function getInitials(name: string) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

const formatHashRate = (mhs: number) => {
    if (mhs >= 1_000_000) return `${(mhs / 1_000_000).toFixed(2)} TH/s`;
    if (mhs >= 1_000) return `${(mhs / 1_000).toFixed(2)} GH/s`;
    return `${mhs.toFixed(0)} MH/s`;
};

export default async function CompanyDetailPage({ params }: { params: { companyId: string } }) {
  const companyId = parseInt(params.companyId, 10);
  if (isNaN(companyId)) {
    notFound();
  }

  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  const session = await getSession();
  const isCEO = company.members.some(member => member.userId === session?.id && member.role === 'ceo');
  
  const totalCompanyHashRate = company.miningRigs.reduce((total, ownedRig) => {
    const rigData = getRigById(ownedRig.rigId);
    return total + (rigData?.hashRateMhs || 0) * ownedRig.quantity;
  }, 0);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
            <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-bold tracking-tight">{company.name} ({company.ticker})</h1>
                 {company.isListed ? (
                    <Badge variant="secondary">En Bourse</Badge>
                ) : (
                    <Badge variant="outline">Non Cotée</Badge>
                )}
            </div>
          <p className="text-muted-foreground">{company.description}</p>
        </div>
        <div className="flex items-center gap-2">
            {isCEO && (
                <>
                    <AddCompanyCashDialog companyId={company.id}>
                        <Button variant="outline">Ajouter des fonds</Button>
                    </AddCompanyCashDialog>
                    <WithdrawCompanyCashDialog companyId={company.id} companyCash={company.cash}>
                        <Button variant="outline">Retirer des fonds</Button>
                    </WithdrawCompanyCashDialog>
                     {!company.isListed && <ListCompanyButton companyId={company.id} />}
                </>
            )}
            {company.isListed ? (
                 <Button asChild>
                    <Link href="/companies">Trader à la Bourse</Link>
                </Button>
            ) : (
                <InvestDialog company={company}>
                    <Button>Investir</Button>
                </InvestDialog>
            )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="text-2xl font-bold">${company.sharePrice.toFixed(4)}</div>
                   <p className="text-xs text-muted-foreground">Prix par part de l'entreprise</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Capitalisation Boursière</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">${company.marketCap.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
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
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valeur du Matériel de Minage</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">${company.miningRigsValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <p className="text-xs text-muted-foreground">Valeur totale du matériel détenu</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Récompenses BTC non réclamées</CardTitle>
                  <Bitcoin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{company.unclaimedBtc.toFixed(8)} BTC</div>
                  <p className="text-xs text-muted-foreground">Généré par les opérations de minage</p>
                  {isCEO && company.unclaimedBtc > 1e-9 && (
                    <ClaimBtcButton companyId={company.id} />
                  )}
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
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Membres de l'Équipe</CardTitle>
                  <CardDescription>Liste des membres et de leurs rôles au sein de {company.name}.</CardDescription>
                </div>
                 {isCEO && (
                    <ManageMembersDialog company={company}>
                      <Button variant="outline" size="sm"><Settings className="mr-2 h-4 w-4" /> Gérer</Button>
                    </ManageMembersDialog>
                )}
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

        <Card>
            <CardHeader>
                <CardTitle>Historique des Transactions de l'Entreprise</CardTitle>
                <CardDescription>Journal des achats et ventes d'actifs par {company.name}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Actif</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                            <TableHead className="text-right">Prix Unitaire</TableHead>
                            <TableHead className="text-right">Valeur Totale</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {company.transactions && company.transactions.length > 0 ? company.transactions.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>
                                    <Badge variant={tx.type === 'Buy' ? 'destructive' : 'default'} className={tx.type === 'Sell' ? 'bg-green-600' : ''}>
                                        {tx.type === 'Buy' ? 'Achat' : 'Vente'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{tx.name}</div>
                                    <div className="text-sm text-muted-foreground">{tx.ticker}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono">{tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</TableCell>
                                <TableCell className="text-right font-mono">${tx.price.toFixed(4)}</TableCell>
                                <TableCell className={`text-right font-medium ${tx.type === 'Buy' ? 'text-red-500' : 'text-green-500'}`}>
                                    {tx.type === 'Buy' ? '-' : '+'}${tx.value.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right text-sm">{format(tx.createdAt, 'd MMM yyyy, HH:mm', { locale: fr })}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    Cette entreprise n'a encore effectué aucune transaction.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

       <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Package /> Portefeuille de l'Entreprise
                    </CardTitle>
                    <CardDescription>Actifs et biens détenus par {company.name}.</CardDescription>
                </div>
                {isCEO && (
                    <ManageCompanyAssetsDialog company={company}>
                        <Button variant="outline">Gérer le Portefeuille</Button>
                    </ManageCompanyAssetsDialog>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Actif</TableHead>
                            <TableHead>Quantité</TableHead>
                            <TableHead>Coût Moyen</TableHead>
                            <TableHead className="text-right">Valeur de Coût</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {company.holdings.length > 0 ? company.holdings.map(holding => (
                            <TableRow key={holding.id}>
                                <TableCell>
                                    <div className="font-medium">{holding.name}</div>
                                    <div className="text-sm text-muted-foreground">{holding.ticker}</div>
                                </TableCell>
                                <TableCell>{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</TableCell>
                                <TableCell>${holding.avgCost.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${(holding.quantity * holding.avgCost).toFixed(2)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Cette entreprise ne détient encore aucun actif.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cpu /> Opération de Minage de l'Entreprise
                </CardTitle>
                <CardDescription>
                    Matériel de minage détenu par {company.name}. Puissance totale : {formatHashRate(totalCompanyHashRate)}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Matériel</TableHead>
                            <TableHead>Quantité</TableHead>
                            <TableHead className="text-right">Puissance de Hachage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {company.miningRigs.length > 0 ? company.miningRigs.map(ownedRig => {
                            const rigData = getRigById(ownedRig.rigId);
                            if (!rigData) return null;
                            return (
                                <TableRow key={ownedRig.id}>
                                    <TableCell>
                                        <div className="font-medium">{rigData.name}</div>
                                    </TableCell>
                                    <TableCell>{ownedRig.quantity}</TableCell>
                                    <TableCell className="text-right">{formatHashRate(rigData.hashRateMhs * ownedRig.quantity)}</TableCell>
                                </TableRow>
                            )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    Cette entreprise ne possède aucun matériel de minage.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
