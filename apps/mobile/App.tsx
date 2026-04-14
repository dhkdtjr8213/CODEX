import { MobileLedgerApp } from "./src/mobile-ledger-app";
import { MobileQueryProvider } from "./src/query-provider";

export default function App() {
  return (
    <MobileQueryProvider>
      <MobileLedgerApp />
    </MobileQueryProvider>
  );
}
