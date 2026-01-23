
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
                    <Link href={`/companies/${company.id}`}>Details</Link>
                </Button>
                <InvestDialog company={company as CompanyWithDetails}>
                    <Button size="sm">Invest</Button>
                </InvestDialog>
                 {hasShares && (
                    <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                    >
                        <Button size="sm" variant="secondary">Sell</Button>
                    </SellSharesDialog>
                )}
            </TableCell>
        </TableRow>
    );
}

function CompanyTable({ title, description, companies, type }: { title: string, description: string, companies: any[], type: 'managed' | 'invested' | 'other' }) {
    const headers = {
        managed: ["Company", "My Role", "My Shares", "Shares Value", ""],
        invested: ["Company", "Shares Held", "Shares Value", ""],
        other: ["Company", "Cash", "Market Cap", ""],
    };
    
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
                                    {type === 'managed' ? "You don't manage any companies." : type === 'invested' ? "You haven't invested in any private companies." : "No private companies available."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


function StockExchangeCard({ company }: { company: ListedCompany }) {
    const changeIsPositive = company.change24h.startsWith('+');
    const chartConfig = {
        price: {
            label: 'Price',
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
                    <Badge variant="secondary">Listed</Badge>
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
                    <Link href={`/companies/${company.id}`}>Details</Link>
                </Button>
                 <InvestDialog company={company as any} isListed>
                    <Button size="sm">Buy</Button>
                </InvestDialog>
                {company.sharesHeld > 0 && (
                    <SellSharesDialog
                        companyId={company.id}
                        companyName={company.name}
                        sharePrice={company.sharePrice}
                        sharesHeld={company.sharesHeld}
                        isListed
                    >
                        <Button size="sm" variant="secondary">Sell</Button>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Companies & Stock Exchange</h1>
                    <p className="text-muted-foreground">Create, manage, and trade player-owned companies.</p>
                </div>
                <CreateCompanyDialog />
            </div>

            {managedCompanies.length > 0 && (
                <CompanyTable
                    title="My Companies (CEO)"
                    description="Companies you manage directly. You can also hold shares in them."
                    companies={managedCompanies}
                    type="managed"
                />
            )}

            {investedCompanies.length > 0 && (
                <CompanyTable
                    title="My Investments (Private Companies)"
                    description="Private companies in which you hold shares but don't manage."
                    companies={investedCompanies}
                    type="invested"
                />
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle>Stock Exchange</CardTitle>
                    <CardDescription>Listed companies available for public trading.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {listedCompanies.length > 0 ? (
                        listedCompanies.map((company) => <StockExchangeCard key={company.id} company={company} />)
                    ) : (
                        <p className="col-span-full py-12 text-center text-muted-foreground">No companies are currently listed on the stock exchange.</p>
                    )}
                </CardContent>
            </Card>

            {otherPrivateCompanies.length > 0 && (
                 <CompanyTable
                    title="Other Private Companies"
                    description="Unlisted companies in which you can make an initial investment."
                    companies={otherPrivateCompanies}
                    type="other"
                />
            )}
        </div>
    );
}
