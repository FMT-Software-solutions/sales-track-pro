import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Users, MessageCircle, Mail, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpDrawerProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type HelpSection = 'roles' | 'faq';

const roleData = [
  {
    name: 'Super Admins (Owners)',
    description: 'Owners of the app with access to all permissions',
    color: 'bg-purple-100 text-purple-800',
    permissions: [
      'Full system access and control',
      'Manage all organizations and branches',
      'Create and manage admin users',
      'Access all financial data and reports',
      'Configure system settings',
      'Manage user roles and permissions',
      'Delete sales records',
      'View audit trails and activity logs',
    ],
  },
  {
    name: 'Admins',
    description: 'Can manage all branches and have administrative privileges',
    color: 'bg-red-100 text-red-800',
    permissions: [
      'Manage all branches within organization',
      'Create and manage branch managers and sales persons',
      'Access all branch financial data',
      'Generate comprehensive reports',
      'Edit and remove sales records',
      'Manage categories and products',
      'View activity logs across all branches',
    ],
  },
  {
    name: 'Branch Managers',
    description:
      'Admins for specific branches, can only manage assigned branches',
    color: 'bg-blue-100 text-blue-800',
    permissions: [
      'Manage assigned branch operations',
      'Create and manage sales persons for their branch',
      'Access branch-specific financial data',
      'Generate branch reports',
      'Edit, remove, and correct branch sales records',
      'Manage branch expenses',
      'View branch activity logs',
      'Oversee daily branch operations',
    ],
  },
  {
    name: 'Auditors',
    description:
      'Read-only access for auditing, analysis, and reporting purposes',
    color: 'bg-yellow-100 text-yellow-800',
    permissions: [
      'View all financial data (read-only)',
      'Access comprehensive reports',
      'Review sales and expense records',
      'View activity logs and audit trails',
      'Generate audit reports',
      'Monitor compliance and procedures',
      'No editing or deletion capabilities',
      'Export data for analysis',
    ],
  },
  {
    name: 'Sales Persons',
    description: 'Can manage sales for their assigned branches',
    color: 'bg-green-100 text-green-800',
    permissions: [
      'Create new sales records',
      'Correct their own sales entries',
      'View branch sales data',
      'Access basic sales reports',
      'Manage customer transactions',
      'Process refunds and corrections',
      'View assigned branch information',
      'Limited access to expense data',
    ],
  },
];

const faqData = [
  {
    question: 'What is SalesTrack Pro?',
    answer:
      'SalesTrack Pro is a comprehensive sales and expense management system designed for multi-branch businesses. It helps track sales, manage expenses, generate reports, and maintain audit trails across different locations.',
  },
  {
    question: 'How do I record a new sale?',
    answer:
      'Navigate to the Sales section from the sidebar, click "Record Sale" or the "+" button, fill in the required details including items, quantities, and customer information, then save the transaction.',
  },
  {
    question: 'Can I edit or delete sales records?',
    answer:
      'Yes, but permissions depend on your role. Sales persons can correct their own entries, branch managers can edit branch sales, and admins/owners have broader editing capabilities. All changes are logged for audit purposes.',
  },
  {
    question: 'How do I generate reports?',
    answer:
      'Go to the Reports section where you can generate various reports including sales summaries, expense reports, and financial statements. Filter by date range, branch, or other criteria as needed.',
  },
  {
    question: 'What are activity logs?',
    answer:
      'Activity logs track all user actions in the system including sales creation, edits, deletions, and user management activities. They provide a complete audit trail for compliance and monitoring purposes.',
  },
  {
    question: 'How do I manage my branch information?',
    answer:
      'Branch information can be managed in the Branches section (for admins) or through your assigned branch settings. Update contact details, addresses, and operational settings as needed.',
  },
  {
    question: 'Can I print receipts for sales?',
    answer:
      'Yes, you can print receipts for sales transactions. After recording a sale, look for the print or receipt option in the sales details view. This feature allows you to generate professional receipts for customers with transaction details, items purchased, and totals.',
  },
  {
    question: 'Can I export data?',
    answer:
      'Yes, most reports and data views include export options. You can typically export to Excel, CSV, or PDF formats depending on the section and your role permissions.',
  },
  {
    question: 'How do I get help or report issues?',
    answer:
      'For technical support, contact your system administrator or IT department. For business-related questions, reach out to your branch manager or admin. You can also refer to this help section for common questions.',
  },
];

export function HelpDrawer({ children, open, onOpenChange }: HelpDrawerProps) {
  const [activeSection, setActiveSection] = useState<HelpSection>('faq');
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const sidebarItems = [
    { id: 'faq' as HelpSection, label: 'FAQ', icon: MessageCircle },
    { id: 'roles' as HelpSection, label: 'User Roles', icon: Users },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      {children && <DrawerTrigger asChild>{children}</DrawerTrigger>}
      <DrawerContent className="h-screen rounded-none pb-20 border-1">
        <div className="mx-auto w-full max-w-5xl border border-b-0 h-screen">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between ">
              <div>
                <DrawerTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Help & Support
                </DrawerTitle>
                <DrawerDescription>
                  Learn about user roles, permissions, and frequently asked
                  questions
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex h-full max-w-5xl mx-auto ">
            {/* Sidebar */}
            <div className="w-64 border-r bg-gray-50 p-4">
              <nav className="space-y-2">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors',
                        activeSection === item.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden pb-20">
              <ScrollArea className="h-full p-6">
                {activeSection === 'roles' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        User Roles & Permissions
                      </h2>
                      <p className="text-gray-600 mb-6">
                        Understanding different user roles and their
                        capabilities in SalesTrack Pro
                      </p>
                    </div>

                    <div className="space-y-6">
                      {roleData.map((role, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-6 bg-white"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <Badge className={role.color}>{role.name}</Badge>
                          </div>
                          <p className="text-gray-700 mb-4">
                            {role.description}
                          </p>

                          <div>
                            <h4 className="font-semibold mb-3 text-gray-900">
                              Permissions & Capabilities:
                            </h4>
                            <ul className="space-y-2">
                              {role.permissions.map((permission, permIndex) => (
                                <li
                                  key={permIndex}
                                  className="flex items-start gap-2"
                                >
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                  <span className="text-gray-700">
                                    {permission}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSection === 'faq' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        Frequently Asked Questions
                      </h2>
                      <p className="text-gray-600 mb-6">
                        Common questions about using SalesTrack Pro
                      </p>
                    </div>

                    <div className="space-y-4">
                      {faqData.map((faq, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-6 bg-white"
                        >
                          <h3 className="font-semibold text-gray-900 mb-3">
                            {faq.question}
                          </h3>
                          <p className="text-gray-700 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-8" />

                    <div className="bg-blue-50 rounded-lg p-6">
                      <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Need More Help?
                      </h3>
                      <p className="text-blue-800 mb-4">
                        If you can't find the answer you're looking for, don't
                        hesitate to reach out for support.
                      </p>
                      <div className="space-y-2 text-sm text-blue-700">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span>Contact your system administrator</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>Reach out to your branch manager</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3 w-3" />
                          <span>
                            Submit a support ticket through your IT department
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
