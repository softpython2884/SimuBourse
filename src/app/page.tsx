import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Portfolio Value
            </CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Crypto Holdings
            </CardTitle>
            <span className="text-2xl">₿</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2.73 BTC</div>
            <p className="text-xs text-muted-foreground">
              +18.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Trades</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12</div>
            <p className="text-xs text-muted-foreground">
              +2 since last hour
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Prediction Market Wins
            </CardTitle>
            <span className="text-2xl">🏆</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+54</div>
            <p className="text-xs text-muted-foreground">
              3 new predictions active
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Top Movers</CardTitle>
              <CardDescription>
                Assets with the highest price change in the last 24 hours.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/trading">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Change (24h)</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Market Cap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Tesla, Inc.</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      TSLA
                    </div>
                  </TableCell>
                  <TableCell className="text-right">$177.46</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-green-500 dark:text-green-400">+5.42%</TableCell>
                  <TableCell className="hidden md:table-cell text-right">$565.4B</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Bitcoin</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      BTC
                    </div>
                  </TableCell>
                  <TableCell className="text-right">$67,120.50</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-green-500 dark:text-green-400">+2.10%</TableCell>
                  <TableCell className="hidden md:table-cell text-right">$1.32T</TableCell>
                </TableRow>
                 <TableRow>
                  <TableCell>
                    <div className="font-medium">Ethereum</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      ETH
                    </div>
                  </TableCell>
                  <TableCell className="text-right">$3,450.78</TableCell>
                   <TableCell className="hidden sm:table-cell text-right text-red-500 dark:text-red-400">-1.50%</TableCell>
                  <TableCell className="hidden md:table-cell text-right">$414.5B</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">NVIDIA Corporation</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      NVDA
                    </div>
                  </TableCell>
                  <TableCell className="text-right">$120.89</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-green-500 dark:text-green-400">+8.97%</TableCell>
                  <TableCell className="hidden md:table-cell text-right">$2.97T</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8">
            <div className="flex items-center gap-4">
              <div className="grid gap-1">
                <p className="text-sm font-medium leading-none">
                  Bought 10 AAPL
                </p>
                <p className="text-sm text-muted-foreground">
                  Apple Inc.
                </p>
              </div>
              <div className="ml-auto font-medium">-$2,076.90</div>
            </div>
            <div className="flex items-center gap-4">
               <div className="grid gap-1">
                <p className="text-sm font-medium leading-none">
                  Sold 0.5 ETH
                </p>
                <p className="text-sm text-muted-foreground">
                  Ethereum
                </p>
              </div>
              <div className="ml-auto font-medium">+$1,725.39</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="grid gap-1">
                <p className="text-sm font-medium leading-none">
                  Won Prediction
                </p>
                <p className="text-sm text-muted-foreground">
                  Election Outcome: Candidate A
                </p>
              </div>
              <div className="ml-auto font-medium">+$500.00</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
