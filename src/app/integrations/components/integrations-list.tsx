"use client";

import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import type { Integration as IntegrationAppIntegration } from "@integration-app/sdk";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogDescription } from "@/components/ui/dialog";

export function IntegrationList() {
	const integrationApp = useIntegrationApp();
	const { integrations, refresh } = useIntegrations();
	const [configuringKey, setConfiguringKey] = useState<string | null>(null);
	const [syncingKey, setSyncingKey] = useState<string | null>(null);
	const [objectTypesDialog, setObjectTypesDialog] = useState<{
		isOpen: boolean;
		integration: IntegrationAppIntegration | null;
		objectTypes: Array<{ id: string; name: string }>;
		selectedObjects: string[];
		isLoading: boolean;
		isCreating: boolean;
	}>({
		isOpen: false,
		integration: null,
		objectTypes: [],
		selectedObjects: [],
		isLoading: false,
		isCreating: false,
	});

	const fetchObjectTypes = async (integration: IntegrationAppIntegration) => {
		if (!integration.connection?.id) {
			console.error(`No connection found for integration: ${integration.key}`);
			return;
		}

		// Set loading state
		setObjectTypesDialog((prev) => ({
			...prev,
			isOpen: true,
			integration,
			isLoading: true,
			objectTypes: [],
			selectedObjects: [],
		}));

		try {
			console.log(`Fetching object types for integration: ${integration.key}`);

			// Make direct API request to fetch object types
			const response = await fetch(
				`https://api.integration.app/connections/${integration.connection.id}/data/object-types/list`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${await integrationApp.getToken()}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			if (data?.records && data.records.length > 0) {
				const objectTypes = data.records.map((record: any) => ({
					id: record.fields?.id || record.id,
					name: record.fields?.name || record.name,
				}));

				console.log(`Found ${objectTypes.length} object types:`, objectTypes);

				// Update dialog with object types
				setObjectTypesDialog((prev) => ({
					...prev,
					isLoading: false,
					objectTypes,
				}));
			} else {
				console.log(
					`No object types found for integration: ${integration.key}`
				);
				setObjectTypesDialog((prev) => ({
					...prev,
					isLoading: false,
				}));
			}
		} catch (error) {
			console.error("Failed to fetch object types:", error);
			setObjectTypesDialog((prev) => ({
				...prev,
				isLoading: false,
			}));
			alert("Failed to fetch object types. Please try again.");
		}
	};

	const handleConnect = async (integration: IntegrationAppIntegration) => {
		try {
			// Step 1: Open new connection
			await integrationApp.integration(integration.key).openNewConnection();

			// Step 2: Refresh to get the new connection
			await refresh();

			// Step 3: Get the updated integration with connection
			const updatedIntegrations = await integrationApp.integrations.find();
			const updatedIntegration = updatedIntegrations?.items?.find(
				(i) => i.key === integration.key
			);

			if (!updatedIntegration?.connection?.id) {
				console.error(
					`No connection found for integration: ${integration.key}`
				);
				return;
			}

			// Step 4: Fetch all actions for this integration
			console.log(`Fetching actions for integration: ${integration.key}`);
			const actionsResponse = await integrationApp.actions.find({
				integrationId: updatedIntegration.id,
			});

			if (actionsResponse?.items && actionsResponse.items.length > 0) {
				console.log(
					`Found ${actionsResponse.items.length} actions for ${integration.key}`
				);

				// Step 5: Create action instances for each action
				for (const action of actionsResponse.items) {
					try {
						console.log(`Creating action instance for: ${action.key}`);
						await integrationApp
							.connection(updatedIntegration.connection.id)
							.action(action.key)
							.get({ autoCreate: true });
						console.log(`✅ Action instance created for: ${action.key}`);
					} catch (actionError) {
						console.error(
							`❌ Failed to create action instance for ${action.key}:`,
							actionError
						);
					}
				}
			} else {
				console.log(`No actions found for integration: ${integration.key}`);
			}

			// Step 6: Fetch object types and show selection dialog
			await fetchObjectTypes(updatedIntegration);
		} catch (error) {
			console.error("Failed to connect:", error);
		}
	};

	const handleDisconnect = async (integration: IntegrationAppIntegration) => {
		if (!integration.connection?.id) return;
		try {
			await integrationApp.connection(integration.connection.id).archive();
			refresh();
		} catch (error) {
			console.error("Failed to disconnect:", error);
		}
	};

	const handleConfigure = async (integration: IntegrationAppIntegration) => {
		try {
			setConfiguringKey(integration.key);
			await integrationApp.integration(integration.key).open();
		} catch (error) {
			console.error("Failed to configure integration:", error);
		} finally {
			setConfiguringKey(null);
		}
	};

	const handleSyncActions = async (integration: IntegrationAppIntegration) => {
		if (!integration.connection?.id) {
			console.error(`No connection found for integration: ${integration.key}`);
			return;
		}

		try {
			setSyncingKey(integration.key);
			console.log(`Syncing actions for integration: ${integration.key}`);

			// Fetch all actions for this integration
			const actionsResponse = await integrationApp.actions.find({
				integrationId: integration.id,
			});

			if (actionsResponse?.items && actionsResponse.items.length > 0) {
				console.log(
					`Found ${actionsResponse.items.length} actions for ${integration.key}`
				);

				// Create action instances for each action
				for (const action of actionsResponse.items) {
					try {
						console.log(`Creating action instance for: ${action.key}`);
						await integrationApp
							.connection(integration.connection.id)
							.action(action.key)
							.get({ autoCreate: true });
						console.log(`✅ Action instance created for: ${action.key}`);
					} catch (actionError) {
						console.error(
							`❌ Failed to create action instance for ${action.key}:`,
							actionError
						);
					}
				}
			} else {
				console.log(`No actions found for integration: ${integration.key}`);
			}

			// After syncing actions, fetch object types and show selection dialog
			await fetchObjectTypes(integration);
		} catch (error) {
			console.error("Failed to sync actions:", error);
		} finally {
			setSyncingKey(null);
		}
	};

	const handleObjectSelection = (objectId: string, checked: boolean) => {
		setObjectTypesDialog((prev) => ({
			...prev,
			selectedObjects: checked
				? [...prev.selectedObjects, objectId]
				: prev.selectedObjects.filter((id) => id !== objectId),
		}));
	};

	const handleCreateObjectActionInstances = async () => {
		const { integration, selectedObjects } = objectTypesDialog;

		if (!integration?.connection?.id || selectedObjects.length === 0) {
			return;
		}

		// Set creating state
		setObjectTypesDialog((prev) => ({
			...prev,
			isCreating: true,
		}));

		try {
			console.log(
				`Creating action instances for selected objects:`,
				selectedObjects
			);

			for (const objectId of selectedObjects) {
				try {
					console.log(`Creating action instance for object: ${objectId}`);
					await integrationApp
						.connection(integration.connection.id)
						.action("update-data-record", { instanceKey: objectId })
						.get({ autoCreate: true });
					console.log(`✅ Action instance created for object: ${objectId}`);

					// Set the data collection with objectType parameter
					try {
						console.log(`Setting data collection for object: ${objectId}`);
						await integrationApp
							.connection(integration.connection.id)
							.dataSource("objects", { instanceKey: objectId })
							.patch({ collectionParameters: { objectType: objectId } });
						console.log(`✅ Data collection set for object: ${objectId}`);
					} catch (dataSourceError) {
						console.error(
							`❌ Failed to set data collection for object ${objectId}:`,
							dataSourceError
						);
					}
				} catch (actionError) {
					console.error(
						`❌ Failed to create action instance for object ${objectId}:`,
						actionError
					);
				}
			}

			// Close dialog
			setObjectTypesDialog({
				isOpen: false,
				integration: null,
				objectTypes: [],
				selectedObjects: [],
				isLoading: false,
				isCreating: false,
			});
		} catch (error) {
			console.error("Failed to create object action instances:", error);
			setObjectTypesDialog((prev) => ({
				...prev,
				isCreating: false,
			}));
			alert("Failed to create action instances. Please try again.");
		}
	};

	return (
		<>
			<ul className="space-y-4 mt-8">
				{integrations.map((integration) => (
					<li
						key={integration.key}
						className="group flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
					>
						<div className="flex-shrink-0">
							{integration.logoUri ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={integration.logoUri}
									alt={`${integration.name} logo`}
									className="w-10 h-10 rounded-lg"
								/>
							) : (
								<div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-medium text-gray-600 dark:text-gray-300">
									{integration.name[0]}
								</div>
							)}
						</div>
						<div className="flex-1 min-w-0">
							<h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
								{integration.name}
							</h3>
						</div>
						<div className="flex gap-2">
							{integration.connection && (
								<>
									<button
										onClick={() => handleConfigure(integration)}
										disabled={configuringKey === integration.key}
										className="px-4 py-2 rounded-md font-medium transition-colors bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 hover:bg-green-200 hover:text-green-800 dark:hover:bg-green-800 dark:hover:text-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{configuringKey === integration.key
											? "Configuring..."
											: "Configure"}
									</button>
									<button
										onClick={() => handleSyncActions(integration)}
										disabled={syncingKey === integration.key}
										className="px-4 py-2 rounded-md font-medium transition-colors bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100 hover:bg-blue-200 hover:text-blue-800 dark:hover:bg-blue-800 dark:hover:text-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{syncingKey === integration.key
											? "Syncing..."
											: "Sync Actions"}
									</button>
								</>
							)}
							<button
								onClick={() =>
									integration.connection
										? handleDisconnect(integration)
										: handleConnect(integration)
								}
								className={`px-4 py-2 rounded-md font-medium transition-colors ${
									integration.connection
										? "bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 hover:bg-red-200 hover:text-red-800 dark:hover:bg-red-800 dark:hover:text-red-100"
										: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-700 dark:hover:text-blue-100"
								}`}
							>
								{integration.connection ? "Disconnect" : "Connect"}
							</button>
						</div>
					</li>
				))}
			</ul>

			{/* Object Types Selection Dialog */}
			<Dialog
				open={objectTypesDialog.isOpen}
				onOpenChange={(open) =>
					setObjectTypesDialog((prev) => ({ ...prev, isOpen: open }))
				}
			>
				<DialogContent className="max-w-md bg-background text-foreground border-border">
					<DialogHeader>
						<DialogTitle>
							Select Objects for {objectTypesDialog.integration?.name}
						</DialogTitle>
						<DialogDescription>
							Choose which objects you'd like to work with. Action instances
							will be created for each selected object.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						{objectTypesDialog.isLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						) : objectTypesDialog.objectTypes.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4">
								No objects found for this integration.
							</p>
						) : (
							<div className="max-h-60 overflow-y-auto space-y-2">
								{objectTypesDialog.objectTypes.map((objectType) => (
									<div
										key={objectType.id}
										className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent"
									>
										<Checkbox
											id={objectType.id}
											checked={objectTypesDialog.selectedObjects.includes(
												objectType.id
											)}
											onCheckedChange={(checked: boolean) =>
												handleObjectSelection(objectType.id, checked)
											}
											disabled={objectTypesDialog.isCreating}
										/>
										<label
											htmlFor={objectType.id}
											className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
										>
											{objectType.name}
										</label>
									</div>
								))}
							</div>
						)}
						<div className="flex justify-end space-x-2">
							<Button
								variant="outline"
								onClick={() =>
									setObjectTypesDialog((prev) => ({ ...prev, isOpen: false }))
								}
								disabled={objectTypesDialog.isCreating}
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateObjectActionInstances}
								disabled={
									objectTypesDialog.selectedObjects.length === 0 ||
									objectTypesDialog.isCreating ||
									objectTypesDialog.isLoading
								}
							>
								{objectTypesDialog.isCreating ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
										Creating...
									</>
								) : (
									`Create Actions (${objectTypesDialog.selectedObjects.length})`
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
