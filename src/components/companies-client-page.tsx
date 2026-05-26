
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCompanyDialog } from '@/components/create-company-dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { InvestDialog } from '@/components/invest-dialog';
import type { CompanyWithDetails, ManagedCompany, InvestedCompany, ListedCompany, OtherCompany } from '@/lib/actions/companies';
import { SellSharesDialog } from '@/components/sell-shares-dialog';
import { Area, AreaChart, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

function CompanyTableRow({ company, type }: { company: any, type: 'managed' | 'invested' | 'other' }) {
    const hasShares = company.sharesHeld > 0;

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium">{company.name} ({company.ticker})</div>
                <div className="text-sm text-muted-foreground">{company.industry}</div>
            </TableCell>

            {type === 'managed' && <>
                <TableCell><Badge variant="secondary">{company.role.toUpperCase()}</Badge></TableCell>
                <TableCell className="font-mono">{hasShares ? company.sharesHeld.toFixed(4) : '-'}</TableCell>
                <TableCell className="font-mono">{hasShares ? `$${company.sharesValue.toFixed(2)}` : '-'}</TableCell>
            </>}
            {type === 'invested' && <>
                <TableCell className="font-mono">{company.sharesHeld.toFixed(4)}</TableCell>
                <TableCell className="font-mono">${company.sharesValue.toFixed(2)}</TableCell>
            </>}
            {type === 'other' && <>
                <TableCell className="font-mono">${company.cash.toFixed(2)}</TableCell>
                <TableCell className="font-mono">${company.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
            </>}

            <TableCell className="text-right space-x-2">
                <Button asChild variant="outline" size="sm">
                    <Link href={`/companies/${company.id}`}>Détails</Link>
                </Button>
                <InvestDialog company={company as CompanyWithDetails}>
                    <Button size="sm">Investir</Button>
                </InvestDialog>
                 {hasShares && (
                    <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                    >
                        <Button size="sm" variant="secondary">Vendre</Button>
                    </SellSharesDialog>
                )}
            </TableCell>
        </TableRow>
    );
}

function CompanyMobileCard({ company, type }: { company: any, type: 'managed' | 'invested' | 'other' }) {
    const hasShares = company.sharesHeld > 0;

    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate font-medium">{company.name} ({company.ticker})</div>
                    <div className="text-sm text-muted-foreground">{company.industry}</div>
                </div>
                {type === 'managed' && <Badge variant="secondary">{company.role.toUpperCase()}</Badge>}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {type === 'managed' && <>
                    <div><div className="text-xs text-muted-foreground">Mes Parts</div><div className="font-mono">{hasShares ? company.sharesHeld.toFixed(4) : '-'}</div></div>
                    <div><div className="text-xs text-muted-foreground">Valeur des Parts</div><div className="font-mono">{hasShares ? `$${company.sharesValue.toFixed(2)}` : '-'}</div></div>
                </>}
                {type === 'invested' && <>
                    <div><div className="text-xs text-muted-foreground">Parts Détenues</div><div className="font-mono">{company.sharesHeld.toFixed(4)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Valeur des Parts</div><div className="font-mono">${company.sharesValue.toFixed(2)}</div></div>
                </>}
                {type === 'other' && <>
                    <div><div className="text-xs text-muted-foreground">Trésorerie</div><div className="font-mono">${company.cash.toFixed(2)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Cap. Boursière</div><div className="font-mono">${company.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                </>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/companies/${company.id}`}>Détails</Link>
                </Button>
                <InvestDialog company={company as CompanyWithDetails}>
                    <Button size="sm" className="flex-1">Investir</Button>
                </InvestDialog>
                {hasShares && (
                    <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                    >
                        <Button size="sm" variant="secondary" className="flex-1">Vendre</Button>
                    </SellSharesDialog>
                )}
            </div>
        </div>
    );
}

function CompanyTable({ title, description, companies, type }: { title: string, description: string, companies: any[], type: 'managed' | 'invested' | 'other' }) {
    const headers = {
        managed: ["Entreprise", "Mon Rôle", "Mes Parts", "Valeur des Parts", ""],
        invested: ["Entreprise", "Parts Détenues", "Valeur des Parts", ""],
        other: ["Entreprise", "Trésorerie", "Cap. Boursière", ""],
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Desktop: table */}
                <div className="hidden md:block">
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
                                    {type === 'managed' ? "Vous ne gérez aucune entreprise." : type === 'invested' ? "Vous n'avez investi dans aucune entreprise privée." : "Aucune entreprise privée disponible."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>

                {/* Mobile: stacked cards */}
                <div className="space-y-3 md:hidden">
                    {companies.length > 0 ? (
                        companies.map((company) => <CompanyMobileCard key={company.id} company={company} type={type} />)
                    ) : (
                        <div className="flex h-24 items-center justify-center text-center text-muted-foreground">
                            {type === 'managed' ? "Vous ne gérez aucune entreprise." : type === 'invested' ? "Vous n'avez investi dans aucune entreprise privée." : "Aucune entreprise privée disponible."}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}


function StockExchangeCard({ company }: { company: ListedCompany }) {
    const changeIsPositive = company.change24h.startsWith('+');
    const chartConfig = {
        price: {
            label: 'Prix',
            color: changeIsPositive ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))',
        },
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base">{company.name} ({company.ticker})</CardTitle>
                        <CardDescription>{company.industry}</CardDescription>
                    </div>
                    <Badge variant="secondary">En Bourse</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="h-[100px] w-full -translate-x-4">
                    <ChartContainer config={chartConfig}>
                        <AreaChart
                            accessibilityLayer
                            data={company.historicalData}
                            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                        >
                             <defs>
                                <linearGradient id={`fill-${company.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" hideLabel />}
                            />
                            <Area
                                dataKey="price"
                                type="natural"
                                fill={`url(#fill-${company.ticker})`}
                                strokeWidth={2}
                                stroke="var(--color-price)"
                                stackId="a"
                            />
                        </AreaChart>
                    </ChartContainer>
                </div>
                <div>
                     <div className="text-xl font-bold">${company.sharePrice.toFixed(4)}</div>
                     <p className={`text-xs ${changeIsPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {company.change24h} (24h)
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                    <Link href={`/companies/${company.id}`}>Détails</Link>
                </Button>
                 <InvestDialog company={company as any} isListed>
                    <Button size="sm">Acheter</Button>
                </InvestDialog>
                {company.sharesHeld > 0 && (
                    <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                        isListed
                    >
                        <Button size="sm" variant="secondary">Vendre</Button>
                    </SellSharesDialog>
                )}
            </CardFooter>
        </Card>
    );
}

interface CompaniesClientPageProps {
    managedCompanies: ManagedCompany[];
    investedCompanies: InvestedCompany[];
    otherPrivateCompanies: OtherCompany[];
    listedCompanies: ListedCompany[];
}

export function CompaniesClientPage({ managedCompanies, investedCompanies, otherPrivateCompanies, listedCompanies }: CompaniesClientPageProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Espace Entreprises & Bourse</h1>
                    <p className="text-muted-foreground">Créez, gérez et tradez des entreprises dirigées par des joueurs.</p>
                </div>
                <CreateCompanyDialog />
            </div>

            {managedCompanies.length > 0 && (
                <CompanyTable 
                    title="Mes Entreprises (Dirigeant)"
                    description="Les entreprises que vous gérez directement. Vous pouvez également y détenir des parts."
                    companies={managedCompanies}
                    type="managed"
                />
            )}

            {investedCompanies.length > 0 && (
                <CompanyTable
                    title="Mes Investissements (Entreprises Privées)"
                    description="Les entreprises privées dans lesquelles vous détenez des parts mais que vous ne gérez pas."
                    companies={investedCompanies}
                    type="invested"
                />
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Bourse des Entreprises</CardTitle>
                    <CardDescription>Entreprises cotées disponibles pour le trading public.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {listedCompanies.length > 0 ? (
                        listedCompanies.map((company) => <StockExchangeCard key={company.id} company={company} />)
                    ) : (
                        <p className="col-span-full py-12 text-center text-muted-foreground">Aucune entreprise n'est actuellement cotée en bourse.</p>
                    )}
                </CardContent>
            </Card>

            {otherPrivateCompanies.length > 0 && (
                 <CompanyTable
                    title="Autres Entreprises Privées"
                    description="Entreprises non cotées dans lesquelles vous pouvez réaliser un investissement initial."
                    companies={otherPrivateCompanies}
                    type="other"
                />
            )}
        </div>
    );
}
