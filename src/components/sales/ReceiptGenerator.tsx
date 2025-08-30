import { useState } from 'react';
import { Sale, useUpdateSaleReceiptGenerated } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Download,
  Printer,
  ReceiptText,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ReceiptGeneratorProps {
  sale: Sale;
}

export function ReceiptGenerator({ sale }: ReceiptGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const updateReceiptGenerated = useUpdateSaleReceiptGenerated();
  const { currentOrganization } = useOrganization();

  const trackReceiptGeneration = async () => {
    try {
      await updateReceiptGenerated.mutateAsync(sale.id);
    } catch (error) {
      console.error('Error tracking receipt generation:', error);
    }
  };

  const handlePrint = async () => {
    await trackReceiptGeneration();

    const printContent = document.getElementById('receipt-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${sale.id.slice(-8).toUpperCase()}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .receipt {
              max-width: 300px;
              margin: 0 auto;
              border: 1px solid #ddd;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .branch-info {
              font-size: 12px;
              margin-bottom: 5px;
            }
            .receipt-info {
              margin-bottom: 15px;
            }
            .receipt-info div {
              margin-bottom: 3px;
              font-size: 12px;
            }
            .items {
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 10px 0;
              margin: 15px 0;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .total {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              margin-top: 15px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 10px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
            .status-banner {
              background: #fee2e2;
              border: 2px solid #dc2626;
              color: #dc2626;
              text-align: center;
              padding: 8px;
              margin: 10px 0;
              font-weight: bold;
              font-size: 12px;
            }
            .status-banner.voided {
              background: #fef2f2;
              border-color: #ef4444;
              color: #ef4444;
            }
            .status-banner.corrected {
              background: #fef3c7;
              border-color: #f59e0b;
              color: #f59e0b;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .receipt { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleDownloadPDF = async () => {
    try {
      await trackReceiptGeneration();

      // For a simple implementation, we'll use the browser's print to PDF functionality
      // In a production app, you might want to use a library like jsPDF or Puppeteer
      const printContent = document.getElementById('receipt-content');
      if (!printContent) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${sale.id.slice(-8).toUpperCase()}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 20px;
                background: white;
              }
              .receipt {
                max-width: 300px;
                margin: 0 auto;
                border: 1px solid #ddd;
                padding: 20px;
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
                margin-bottom: 15px;
              }
              .business-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .branch-info {
                font-size: 12px;
                margin-bottom: 5px;
              }
              .receipt-info {
                margin-bottom: 15px;
              }
              .receipt-info div {
                margin-bottom: 3px;
                font-size: 12px;
              }
              .items {
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
                padding: 10px 0;
                margin: 15px 0;
              }
              .item-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
              }
              .total {
                text-align: center;
                font-size: 16px;
                font-weight: bold;
                margin-top: 15px;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 10px;
                border-top: 1px dashed #000;
                padding-top: 10px;
              }
              .status-banner {
                background: #fee2e2;
                border: 2px solid #dc2626;
                color: #dc2626;
                text-align: center;
                padding: 8px;
                margin: 10px 0;
                font-weight: bold;
                font-size: 12px;
              }
              .status-banner.voided {
                background: #fef2f2;
                border-color: #ef4444;
                color: #ef4444;
              }
              .status-banner.corrected {
                background: #fef3c7;
                border-color: #f59e0b;
                color: #f59e0b;
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <ReceiptText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receipt Preview
            {sale.status === 'voided' && (
              <span className="flex items-center text-red-600 text-sm">
                <XCircle className="h-4 w-4 mr-1" />
                VOIDED
              </span>
            )}
            {sale.status === 'corrected' && (
              <span className="flex items-center text-yellow-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                UPDATED
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Preview */}
          <div
            id="receipt-content"
            className="receipt bg-white border border-gray-300 p-4 font-mono text-sm"
          >
            <div className="header text-center border-b-2 border-black pb-2 mb-4">
              <div className="business-name text-lg font-bold mb-1">
                {currentOrganization?.name || 'Sales Track Pro'}
              </div>
              <div className="branch-info text-xs mb-1">
                Location: {sale.branches?.name || 'Unknown Branch'},{' '}
                {sale.branches?.location || 'Location not specified'}
              </div>
              {sale.branches?.contact && (
                <div className="branch-info text-xs">
                  Contact: {sale.branches.contact}
                </div>
              )}
            </div>

            <div className="receipt-info mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Receipt #:</span>
                <span>{sale.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span>Date:</span>
                <span>{format(new Date(sale.sale_date), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span>Time:</span>
                <span>
                  {format(new Date(sale.created_at || sale.sale_date), 'HH:mm')}
                </span>
              </div>
            </div>

            <div className="items border-t border-b border-dashed border-black py-2 my-4">
              {(sale.sale_line_items || sale.sale_items || []).map(
                (item, index) => (
                  <div key={item.id || index} className="mb-2">
                    <div className="item-row flex justify-between">
                      <span>{item.products?.name || 'Sale Item'}</span>
                      <span>
                        {currentOrganization?.currency || 'GH₵'}{' '}
                        {(item.total_price || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Qty: {item.quantity} ×{' '}
                      {currentOrganization?.currency || 'GH₵'}{' '}
                      {(item.unit_price || 0).toFixed(2)}
                    </div>
                  </div>
                )
              )}
              {sale.customer_name && (
                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-dashed border-gray-400">
                  Customer: {sale.customer_name}
                </div>
              )}
            </div>

            <div className="total text-center text-base font-bold mt-4">
              TOTAL: {currentOrganization?.currency || 'GH₵'}{' '}
              {(sale.amount || 0).toFixed(2)}
            </div>

            <div className="footer text-center mt-5 text-xs border-t border-dashed border-black pt-2">
              <div>Thank you for your business!</div>
              <div className="mt-1">Visit us again soon</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
