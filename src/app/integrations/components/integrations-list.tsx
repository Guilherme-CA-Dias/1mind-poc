"use client";

import { useIntegrationApp, useIntegrations } from "@integration-app/react";
import type { Integration as IntegrationAppIntegration } from "@integration-app/sdk";
import { useState } from "react";

export function IntegrationList() {
	const integrationApp = useIntegrationApp();
	const { integrations, refresh } = useIntegrations();
	const [configuringKey, setConfiguringKey] = useState<string | null>(null);
	const [syncingKey, setSyncingKey] = useState<string | null>(null);

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
		} catch (error) {
			console.error("Failed to sync actions:", error);
		} finally {
			setSyncingKey(null);
		}
	};

	return (
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
	);
}
