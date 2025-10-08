"use client";

import { useState, useEffect } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Database, GitBranch, Loader2 } from "lucide-react";
import { DynamicForm } from "./components/dynamic-form";
import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import { useAuth } from "@/app/auth-provider";

interface FormDefinition {
	_id: string;
	formId: string;
	formTitle: string;
	type: "default" | "custom";
	integrationKey?: string;
	createdAt: string;
	updatedAt: string;
}

export default function FormsPage() {
	const [selectedAction, setSelectedAction] = useState("");
	const [selectedIntegration, setSelectedIntegration] = useState("");
	const [isCreatingForm, setIsCreatingForm] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [newFormData, setNewFormData] = useState({
		name: "",
		id: "",
		integrationKey: "",
	});
	const [forms, setForms] = useState<FormDefinition[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const integrationApp = useIntegrationApp();
	const { integrations } = useIntegrations();
	const { customerId } = useAuth();
	const [configuring, setConfiguring] = useState<
		"dataSource" | "fieldMapping" | null
	>(null);

	// Reset selected integration when form selection changes
	useEffect(() => {
		setSelectedIntegration("");
	}, [selectedAction]);

	// Fetch forms from MongoDB
	useEffect(() => {
		const fetchForms = async () => {
			if (!customerId) return;

			try {
				setIsLoading(true);
				const response = await fetch(`/api/forms?customerId=${customerId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch forms");
				}

				setForms(data.forms);

				// Clear selected action if the form no longer exists
				if (
					selectedAction &&
					!data.forms.find(
						(f: FormDefinition) => `get-${f.formId}` === selectedAction
					)
				) {
					setSelectedAction("");
				}
			} catch (error) {
				console.error("Error fetching forms:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchForms();
	}, [customerId, selectedAction]);

	const handleCreateForm = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!newFormData.integrationKey || !customerId) {
			return;
		}

		try {
			setIsCreatingForm(true);
			const formId = newFormData.id.toUpperCase();

			const response = await fetch("/api/forms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					customerId,
					formId,
					formTitle: newFormData.name,
					integrationKey: newFormData.integrationKey,
				}),
			});

			if (!response.ok) throw new Error("Failed to create form");

			const newForm = await response.json();
			setForms((prev) => [...prev, newForm]);
			setSelectedAction(`get-${formId.toLowerCase()}`);
			setNewFormData({ name: "", id: "", integrationKey: "" });
			setIsDialogOpen(false);
		} catch (error) {
			console.error("Error creating form:", error);
		} finally {
			setIsCreatingForm(false);
		}
	};

	const handleConfigureDataSource = async () => {
		const form = forms.find((f) => f.formId === selectedAction.split("-")[1]);

		if (!form) {
			alert("Form not found. Please try again.");
			return;
		}

		if (!selectedIntegration) {
			alert("Please select an integration first.");
			return;
		}

		try {
			setConfiguring("dataSource");

			// Use the exact form ID as the data source key (e.g., 'leads', 'AI_Engagement_Conversation__c', etc.)
			const dataSourceKey = form.formId;

			// First, open the data source configuration
			await integrationApp
				.connection(selectedIntegration)
				.dataSource(dataSourceKey, { instanceKey: form.formId })
				.openConfiguration();

			// After configuring data source, create a flow instance for receiving events
			const flowPull = integrationApp
				.connection(selectedIntegration)
				.flow(`receive-${dataSourceKey}-events`, { instanceKey: form.formId })
				.get({ autoCreate: true });

			const flowPush = integrationApp
				.connection(selectedIntegration)
				.flow(`send-${dataSourceKey}-events`, { instanceKey: form.formId })
				.get({ autoCreate: true });
		} catch (error) {
			console.error("Error configuring data source or creating flow:", error);
		} finally {
			setConfiguring(null);
		}
	};

	const handleConfigureFieldMapping = async () => {
		const form = forms.find((f) => f.formId === selectedAction.split("-")[1]);

		console.log("Debug - Selected action:", selectedAction);
		console.log("Debug - Found form:", form);
		console.log("Debug - Form integration key:", form?.integrationKey);
		console.log("Debug - Available integrations:", integrations);

		if (!form) {
			console.log("Debug - Form not found, returning early");
			alert("Form not found. Please try again.");
			return;
		}

		if (!selectedIntegration) {
			alert("Please select an integration first.");
			return;
		}

		try {
			setConfiguring("fieldMapping");

			// Use the exact formId as the field mapping key (e.g., 'leads', 'AI_Engagement_Conversation__c', etc.)
			const fieldMappingKey = form.formId;

			// For default forms, don't use instanceKey. For custom forms, use instanceKey.
			const fieldMappingConfig =
				form.type === "default" ? {} : { instanceKey: form.formId };

			console.log("Debug - Field mapping key:", fieldMappingKey);
			console.log("Debug - Field mapping config:", fieldMappingConfig);
			console.log("Debug - Integration key:", selectedIntegration);

			await integrationApp
				.connection(selectedIntegration)
				.fieldMapping(fieldMappingKey, fieldMappingConfig)
				.setup();

			await integrationApp
				.connection(selectedIntegration)
				.fieldMapping(fieldMappingKey, fieldMappingConfig)
				.openConfiguration();
		} catch (error) {
			console.error("Error in field mapping configuration:", error);
			alert(
				"Configuration Error: Failed to open field mapping configuration. Please try again."
			);
		} finally {
			setConfiguring(null);
		}
	};

	return (
		<div className="container mx-auto py-10 space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Forms</h1>
				<p className="text-muted-foreground mt-2">
					Select a record type or create a new form
				</p>
			</div>

			<div className="flex items-center gap-4">
				<Select
					value={selectedAction}
					onChange={(e) => setSelectedAction(e.target.value)}
					className="w-full max-w-md"
					disabled={isLoading}
				>
					<option value="">Select record type</option>
					{forms.map((form) => {
						const integrationName =
							form.type === "custom"
								? integrations.find((i) => i.key === form.integrationKey)?.name
								: null;

						return (
							<option key={form.formId} value={`get-${form.formId}`}>
								{form.formTitle}{" "}
								{form.type === "custom" ? `(Custom - ${integrationName})` : ""}
							</option>
						);
					})}
				</Select>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button className="flex items-center gap-2 bg-primary hover:bg-primary-600 transition-colors">
							<Plus className="h-4 w-4" />
							New Form
						</Button>
					</DialogTrigger>
					<DialogContent className="bg-white dark:bg-gray-950 border-border">
						<DialogHeader>
							<DialogTitle className="text-gray-900 dark:text-gray-100">
								Create New Form
							</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleCreateForm} className="space-y-4">
							<div className="space-y-2">
								<Label
									htmlFor="integration"
									className="text-gray-700 dark:text-gray-300"
								>
									Integration
								</Label>
								<Select
									id="integration"
									value={newFormData.integrationKey}
									onChange={(e) =>
										setNewFormData((prev) => ({
											...prev,
											integrationKey: e.target.value,
										}))
									}
									className="w-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800"
									required
								>
									<option value="">Select integration</option>
									{integrations.map((integration) => (
										<option key={integration.key} value={integration.key}>
											{integration.name}
										</option>
									))}
								</Select>
							</div>
							<div className="space-y-2">
								<Label
									htmlFor="name"
									className="text-gray-700 dark:text-gray-300"
								>
									Form Name
								</Label>
								<Input
									id="name"
									value={newFormData.name}
									onChange={(e) =>
										setNewFormData((prev) => ({
											...prev,
											name: e.target.value,
										}))
									}
									placeholder="e.g., Projects"
									className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label
									htmlFor="id"
									className="text-gray-700 dark:text-gray-300"
								>
									Form ID
								</Label>
								<Input
									id="id"
									value={newFormData.id}
									onChange={(e) =>
										setNewFormData((prev) => ({
											...prev,
											id: e.target.value,
										}))
									}
									placeholder="e.g., PROJ"
									className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800"
									required
									pattern="[A-Za-z]+"
									title="Only letters allowed"
								/>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									Only letters, will be converted to uppercase
								</p>
							</div>
							<Button
								type="submit"
								className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
								disabled={isCreatingForm || !newFormData.integrationKey}
							>
								{isCreatingForm ? "Creating..." : "Create Form"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{selectedAction && (
				<div className="space-y-4">
					<div className="flex items-center gap-4">
						<div className="flex-1">
							<Label
								htmlFor="integration-select"
								className="text-sm font-medium text-gray-700 dark:text-gray-300"
							>
								Select Integration
							</Label>
							<Select
								id="integration-select"
								value={selectedIntegration}
								onChange={(e) => setSelectedIntegration(e.target.value)}
								className="w-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800"
							>
								<option value="">Choose an integration...</option>
								{integrations.map((integration) => (
									<option key={integration.key} value={integration.key}>
										{integration.name}
									</option>
								))}
							</Select>
						</div>
					</div>
					<div className="flex gap-4">
						<Button
							onClick={handleConfigureDataSource}
							className="flex items-center gap-2 bg-primary hover:bg-primary-600 transition-colors"
							disabled={configuring === "dataSource" || !selectedIntegration}
						>
							{configuring === "dataSource" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Database className="h-4 w-4" />
							)}
							Configure Data Source
						</Button>
						<Button
							onClick={handleConfigureFieldMapping}
							className="flex items-center gap-2 bg-primary hover:bg-primary-600 transition-colors"
							disabled={configuring === "fieldMapping" || !selectedIntegration}
						>
							{configuring === "fieldMapping" ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<GitBranch className="h-4 w-4" />
							)}
							Configure Field Mapping
						</Button>
					</div>
				</div>
			)}

			{selectedAction && <DynamicForm recordType={selectedAction} />}
		</div>
	);
}
