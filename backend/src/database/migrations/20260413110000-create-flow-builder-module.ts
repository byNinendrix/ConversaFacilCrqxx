import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Flows", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "draft"
      },
      activeVersionId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowVersions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      flowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Flows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "draft"
      },
      publishedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      graphJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      compiledJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowNodes", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      flowVersionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowVersions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      nodeKey: {
        type: DataTypes.STRING,
        allowNull: false
      },
      nodeType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false
      },
      positionX: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      positionY: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      configJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowEdges", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      flowVersionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowVersions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      sourceNodeKey: {
        type: DataTypes.STRING,
        allowNull: false
      },
      sourceHandle: {
        type: DataTypes.STRING,
        allowNull: true
      },
      targetNodeKey: {
        type: DataTypes.STRING,
        allowNull: false
      },
      conditionType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      conditionValue: {
        type: DataTypes.STRING,
        allowNull: true
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowBindings", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      flowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Flows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      flowVersionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowVersions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "whatsapp"
      },
      event: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "inbound_message"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      queueId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      keywordStart: {
        type: DataTypes.STRING,
        allowNull: true
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowExecutions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      flowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Flows", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      flowVersionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowVersions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      currentNodeKey: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "running"
      },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lockVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      finishedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastInteractionAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      waitUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      contextJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("FlowExecutionEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      executionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowExecutions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      nodeKey: {
        type: DataTypes.STRING,
        allowNull: true
      },
      actionType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      payloadJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await Promise.all([
      queryInterface.addIndex("Flows", ["companyId", "status"], { name: "idx_flows_company_status" }),
      queryInterface.addIndex("FlowVersions", ["flowId", "version"], { name: "idx_flow_versions_flow_version", unique: true }),
      queryInterface.addIndex("FlowVersions", ["companyId", "state"], { name: "idx_flow_versions_company_state" }),
      queryInterface.addIndex("FlowNodes", ["flowVersionId", "nodeKey"], { name: "idx_flow_nodes_version_nodekey", unique: true }),
      queryInterface.addIndex("FlowEdges", ["flowVersionId", "sourceNodeKey", "priority"], { name: "idx_flow_edges_version_source_priority" }),
      queryInterface.addIndex("FlowBindings", ["companyId", "isActive", "channel", "event", "priority"], { name: "idx_flow_bindings_lookup" }),
      queryInterface.addIndex("FlowExecutions", ["companyId", "ticketId", "status"], { name: "idx_flow_exec_company_ticket_status" }),
      queryInterface.addIndex("FlowExecutions", ["status", "waitUntil"], { name: "idx_flow_exec_status_wait" }),
      queryInterface.addIndex("FlowExecutionEvents", ["executionId", "createdAt"], { name: "idx_flow_exec_events_execution_created" })
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.removeIndex("FlowExecutionEvents", "idx_flow_exec_events_execution_created"),
      queryInterface.removeIndex("FlowExecutions", "idx_flow_exec_status_wait"),
      queryInterface.removeIndex("FlowExecutions", "idx_flow_exec_company_ticket_status"),
      queryInterface.removeIndex("FlowBindings", "idx_flow_bindings_lookup"),
      queryInterface.removeIndex("FlowEdges", "idx_flow_edges_version_source_priority"),
      queryInterface.removeIndex("FlowNodes", "idx_flow_nodes_version_nodekey"),
      queryInterface.removeIndex("FlowVersions", "idx_flow_versions_company_state"),
      queryInterface.removeIndex("FlowVersions", "idx_flow_versions_flow_version"),
      queryInterface.removeIndex("Flows", "idx_flows_company_status")
    ]);

    await queryInterface.dropTable("FlowExecutionEvents");
    await queryInterface.dropTable("FlowExecutions");
    await queryInterface.dropTable("FlowBindings");
    await queryInterface.dropTable("FlowEdges");
    await queryInterface.dropTable("FlowNodes");
    await queryInterface.dropTable("FlowVersions");
    await queryInterface.dropTable("Flows");
  }
};
