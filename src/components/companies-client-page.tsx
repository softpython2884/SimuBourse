'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCompanyDialog } from '@/components/create-company-dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { InvestDialog } from '@/components/invest-dialog';
import type { CompanyWithDetails, ManagedCompany, InvestedCompany, OtherCompany } from '@/lib/actions/companies';
import { SellSharesDialog } from '@/components/sell-shares-dialog';


function CompanyTableRow({ company, type }: { company: any, type: 'managed' | 'invested' | 'other' }) {
    return (
        <TableRow>
            <TableCell>
                <div className="font-medium">{company.name} ({company.ticker})</div>
                <div className="text-sm text-muted-foreground">{company.industry}</div>
            </TableCell>
            {type === 'managed' && (
                 <TableCell>
                    <Badge variant="secondary">{company.role.toUpperCase()}</Badge>
                </TableCell>
            )}
            {type === 'invested' && (
                <>
                    <TableCell className="font-mono">{company.sharesHeld.toFixed(4)}</TableCell>
                    <TableCell className="font-mono">${company.sharesValue.toFixed(2)}</TableCell>
                </>
            )}
            {(type === 'managed' || type === 'other') && (
                <TableCell className="font-mono">${company.cash.toFixed(2)}</TableCell>
            )}
             {type === 'other' && (
                <TableCell className="font-mono">${company.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0})}</TableCell>
            )}
            <TableCell className="text-right space-x-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/companies/${company.id}`}>Détails</Link>
                </Button>
                {type === 'invested' && (
                   company.isListed ? (
                     <Button asChild variant="secondary" size="sm">
                       <Link href={`/trading/${company.ticker}`}>Trader</Link>
                     </Button>
                   ) : (
                     <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                     >
                       <Button size="sm" variant="destructive">Vendre</Button>
                     </SellSharesDialog>
                   )
                )}
                {type !== 'managed' && !company.isListed && (
                    <InvestDialog company={company as CompanyWithDetails}>
                        <Button size="sm">Investir</Button>
                    </InvestDialog>
                )}
            </TableCell>
        </TableRow>
    )
}

function CompanyTable({ title, description, companies, type }: { title: string, description: string, companies: any[], type: 'managed' | 'invested' | 'other' }) {
    const headers = {
        managed: ["Entreprise", "Mon Rôle", "Trésorerie", ""],
        invested: ["Entreprise", "Parts Détenues", "Valeur des Parts", ""],
        other: ["Entreprise", "Trésorerie", "Cap. Boursière", ""]
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers[type].map((header, i) => (
                                <TableHead key={i} className={i === headers[type].length - 1 ? 'text-right' : ''}>{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {companies.length > 0 ? (
                            companies.map((company) => <CompanyTableRow key={company.id} company={company} type={type} />)
                        ) : (
                            <TableRow>
                                <TableCell colSpan={headers[type].length} className="h-24 text-center text-muted-foreground">
                                    {type === 'managed' ? "Vous ne gérez aucune entreprise." : type === 'invested' ? "Vous n'avez investi dans aucune entreprise." : "Aucune autre entreprise disponible."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

interface CompaniesClientPageProps {
    managedCompanies: ManagedCompany[];
    investedCompanies: InvestedCompany[];
    otherCompanies: OtherCompany[];
}

export function CompaniesClientPage({ managedCompanies, investedCompanies, otherCompanies }: CompaniesClientPageProps) {
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Espace Entreprises</h1>
                    <p className="text-muted-foreground">Créez, gérez et investissez dans des entreprises dirigées par des joueurs.</p>
                </div>
                <CreateCompanyDialog />
            </div>

            {managedCompanies.length > 0 && (
                <CompanyTable 
                    title="Mes Entreprises (Dirigeant)"
                    description="Les entreprises que vous gérez directement."
                    companies={managedCompanies}
                    type="managed"
                />
            )}

            {investedCompanies.length > 0 && (
                <CompanyTable
                    title="Mes Investissements"
                    description="Les entreprises dans lesquelles vous détenez des parts."
                    companies={investedCompanies}
                    type="invested"
                />
            )}
            
            <CompanyTable
                title="Marché des Entreprises"
                description="Toutes les entreprises disponibles à l'investissement."
                companies={otherCompanies}
                type="other"
            />
        </div>
    );
}
