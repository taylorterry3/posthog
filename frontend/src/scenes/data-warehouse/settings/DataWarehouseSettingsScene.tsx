import { LemonButton, LemonMenu, LemonMenuItems, LemonTable, LemonTag } from '@posthog/lemon-ui'
import { PageHeader } from 'lib/components/PageHeader'
import { SceneExport } from 'scenes/sceneTypes'
import { dataWarehouseSettingsLogic } from './dataWarehouseSettingsLogic'
import { useActions, useValues } from 'kea'
import { IconEllipsis } from 'lib/lemon-ui/icons'
import { dataWarehouseSceneLogic } from '../external/dataWarehouseSceneLogic'
import SourceModal from '../external/SourceModal'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'
import { FEATURE_FLAGS } from 'lib/constants'

export const scene: SceneExport = {
    component: DataWarehouseSettingsScene,
    logic: dataWarehouseSettingsLogic,
}

export function DataWarehouseSettingsScene(): JSX.Element {
    const { dataWarehouseSources, dataWarehouseSourcesLoading } = useValues(dataWarehouseSettingsLogic)
    const { toggleSourceModal } = useActions(dataWarehouseSceneLogic)
    const { isSourceModalOpen } = useValues(dataWarehouseSceneLogic)
    const { featureFlags } = useValues(featureFlagLogic)

    return (
        <div>
            <PageHeader
                title={
                    <div className="flex items-center gap-2">
                        Data Warehouse
                        <LemonTag type="warning" className="uppercase">
                            Beta
                        </LemonTag>
                    </div>
                }
                buttons={
                    featureFlags[FEATURE_FLAGS.DATA_WAREHOUSE_EXTERNAL_LINK] ? (
                        <LemonButton
                            type="primary"
                            data-attr="new-data-warehouse-easy-link"
                            key={'new-data-warehouse-easy-link'}
                            onClick={toggleSourceModal}
                        >
                            Link Source
                        </LemonButton>
                    ) : undefined
                }
                caption={
                    <div>
                        Linked data sources will appear here. Data sources can take a while to sync depending on the
                        size of the source.
                    </div>
                }
            />
            <LemonTable
                dataSource={dataWarehouseSources?.results ?? []}
                loading={dataWarehouseSourcesLoading}
                columns={[
                    {
                        title: 'Source Type',
                        key: 'name',
                        width: 0,
                        render: function RenderName(_, source) {
                            return source.source_type
                        },
                    },
                    {
                        title: 'Status',
                        key: 'status',
                        width: 0,
                        render: function RenderStatus(_, source) {
                            return <LemonTag type="primary">{source.status}</LemonTag>
                        },
                    },

                    {
                        width: 0,
                        render: function Render() {
                            const menuItems: LemonMenuItems = [
                                {
                                    label: 'Remove',
                                    status: 'danger',
                                    onClick: () => {},
                                },
                            ]
                            return (
                                <LemonMenu items={menuItems} placement="left">
                                    <LemonButton size="small" status="stealth" noPadding icon={<IconEllipsis />} />
                                </LemonMenu>
                            )
                        },
                    },
                ]}
            />
            <SourceModal isOpen={isSourceModalOpen} onClose={toggleSourceModal} />
        </div>
    )
}
