"use client";

import { RecordsTable } from "./components/records-table";
import { useRecords } from "@/hooks/use-records";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/app/auth-provider";
import { Toast } from "@/components/ui/toast";
import { useIntegrations } from "@integration-app/react";

interface FormDefinition {
	_id: string;
	formId: string;
	formTitle: string;
	type: "default" | "custom";
	integrationKey?: string;
	createdAt: string;
	updatedAt: string;
}

export default function RecordsPage() {
	const [selectedAction, setSelectedAction] = useState<string | "">(() => {
		// Try to get the last selected action from localStorage
		if (typeof window !== "undefined") {
			return localStorage.getItem("selectedAction") || "";
		}
		return "";
	});
	const [selectedIntegration, setSelectedIntegration] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [forms, setForms] = useState<FormDefinition[]>([]);
	const [isLoadingForms, setIsLoadingForms] = useState(true);
	const [toast, setToast] = useState<{
		type: "success" | "error" | "info";
		message: string;
	} | null>(null);
	const { customerId } = useAuth();
	const { integrations } = useIntegrations();

	const {
		records,
		isLoading,
		isError,
		hasMore,
		loadMore,
		importRecords,
		isImporting,
		mutate,
	} = useRecords(selectedAction || null, searchQuery, selectedIntegration);

	// Reset selected integration when form selection changes
	useEffect(() => {
		setSelectedIntegration("");
	}, [selectedAction]);

	// Fetch forms from MongoDB
	useEffect(() => {
		const fetchForms = async () => {
			if (!customerId) return;

			try {
				setIsLoadingForms(true);
				const response = await fetch(`/api/forms?customerId=${customerId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch forms");
				}

				setForms(data.forms);

				// Auto-select first form if no form is selected and forms are available
				// Only auto-select if there's no persisted selection
				if (!selectedAction && data.forms.length > 0) {
					const firstForm = data.forms[0];
					const actionKey = `get-${firstForm.formId}`;
					setSelectedAction(actionKey);
				}

				// Clear selected action if the form no longer exists
				if (
					selectedAction &&
					!data.forms.find(
						(f: FormDefinition) =>
							`get-${f.formId}` === selectedAction ||
							(f.type === "default" && `get-${f.formId}s` === selectedAction)
					)
				) {
					setSelectedAction("");
				}
			} catch (error) {
				console.error("Error fetching forms:", error);
			} finally {
				setIsLoadingForms(false);
			}
		};

		fetchForms();
	}, [customerId, selectedAction]);

	// Save selected action to localStorage whenever it changes
	useEffect(() => {
		if (selectedAction && typeof window !== "undefined") {
			localStorage.setItem("selectedAction", selectedAction);
		}
	}, [selectedAction]);

	const handleRecordUpdated = () => {
		// Refresh the records list
		mutate();
	};

	const handleRecordDeleted = () => {
		// Refresh the records list
		mutate();
	};

	const handleImportRecords = async () => {
		if (!selectedIntegration) {
			setToast({
				type: "error",
				message: "Please select an integration to import from.",
			});
			return;
		}

		try {
			const result = await importRecords();

			// Show success message with import results
			if (result && typeof result === "object" && "newRecordsCount" in result) {
				const { newRecordsCount, existingRecordsCount } = result;
				setToast({
					type: "success",
					message: `Import completed! ${newRecordsCount} new records imported, ${existingRecordsCount} existing records skipped.`,
				});
			} else {
				setToast({
					type: "success",
					message: "Records imported successfully!",
				});
			}
		} catch (error) {
			setToast({
				type: "error",
				message: `Import failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			});
		}
	};

	return (
		<div className="container mx-auto py-10 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Records</h1>
				<p className="text-muted-foreground mt-2">
					Select a record type to view and manage your records
				</p>
			</div>

			{/* Record Type Selection and Search */}
			<div className="space-y-4">
				<div className="grid gap-6 md:grid-cols-[2fr,2fr]">
					<Select
						value={selectedAction}
						onChange={(e) => setSelectedAction(e.target.value)}
						className="w-full"
						disabled={isLoadingForms}
					>
						<option value="">Select record type</option>
						{forms.map((form) => {
							// For default forms, use the standard action keys (get-contacts, get-leads, etc.)
							// For custom forms, use get-objects with the form ID
							const actionKey =
								form.type === "default"
									? `get-${form.formId}`
									: `get-${form.formId}`;

							return (
								<option key={form.formId} value={actionKey}>
									{form.formTitle} {form.type === "custom" ? "(Custom)" : ""}
								</option>
							);
						})}
					</Select>

					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
						<Input
							placeholder="Search records..."
							className="pl-10"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				{selectedAction && (
					<div className="flex items-center gap-4">
						<div className="flex-1">
							<Label
								htmlFor="integration-select"
								className="text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Select Integration (for import and filtering)
							</Label>
							<Select
								id="integration-select"
								value={selectedIntegration}
								onChange={(e) => setSelectedIntegration(e.target.value)}
								className="w-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800"
							>
								<option value="">All integrations</option>
								{integrations.map((integration) => (
									<option key={integration.key} value={integration.key}>
										{integration.name}
									</option>
								))}
							</Select>
						</div>
						<div className="flex items-end">
							<Button
								onClick={handleImportRecords}
								disabled={
									!selectedAction || !selectedIntegration || isImporting
								}
							>
								{isImporting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Importing...
									</>
								) : (
									<>
										<RefreshCw className="mr-2 h-4 w-4" />
										Import Records
									</>
								)}
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Records Table */}
			<div className="mt-6">
				<RecordsTable
					records={records}
					isLoading={isLoading}
					isError={isError}
					hasMore={hasMore}
					onLoadMore={loadMore}
					onRecordUpdated={handleRecordUpdated}
					onRecordDeleted={handleRecordDeleted}
				/>
			</div>

			{/* Toast Notification */}
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
					duration={5000}
				/>
			)}
		</div>
	);
}
