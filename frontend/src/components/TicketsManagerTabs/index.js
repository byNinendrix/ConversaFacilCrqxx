import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";



import {
  Add as AddIcon,
} from "@material-ui/icons";

import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import SearchIcon from '@material-ui/icons/Search';
import InputBase from '@material-ui/core/InputBase';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Badge from '@material-ui/core/Badge';
import PlaylistAddCheckOutlinedIcon from '@material-ui/icons/PlaylistAddCheckOutlined';
import GroupIcon from '@material-ui/icons/Group';
import toastError from '../../errors/toastError';
import api from '../../services/api';
import { toast } from "react-toastify";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@material-ui/core";
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import ChatIcon from '@material-ui/icons/Chat';
import DoneAllIcon from '@material-ui/icons/DoneAll';
import NewTicketModal from '../NewTicketModal';
import TicketsList from '../TicketsListCustom';
import TicketsListGroup from '../TicketsListGroup';

import TabPanel from '../TabPanel';

import { i18n } from '../../translate/i18n';
import { AuthContext } from '../../context/Auth/AuthContext';
import { SocketContext } from '../../context/Socket/SocketContext';
import { Can } from '../Can';
import TicketsQueueSelect from '../TicketsQueueSelect';
import { TagsFilter } from '../TagsFilter';
import { UsersFilter } from '../UsersFilter';
//import NewTicketGroupModal from '../NewTicketGroup';

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    height: '100%',
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
    overflowX: 'hidden',
    minWidth: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },

  tabsHeader: {
    flex: 'none',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f3f4f6',
    '& .MuiTabs-indicator': {
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.palette.success.main,
    },
  },

  tab: {
    minWidth: 60,
    width: 60,
    minHeight: 54,
    color: '#6b7280',
    transition: 'color 0.2s ease, background-color 0.2s ease',
    '&.Mui-selected': {
      color: theme.palette.success.main,
      backgroundColor: theme.palette.action.hover,
    },
  },

  ticketOptionsBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: theme.spacing(1.25),
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
    minWidth: 0,
    borderBottom: '1px solid #f3f4f6',
  },

  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
    flex: '1 1 420px',
    minWidth: 0,
  },

  button: {
    padding: 8,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    backgroundColor: '#f8fafc',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      backgroundColor: '#ecfeff',
      borderColor: '#a5f3fc',
    },
  },

  icon: {
    color: theme.palette.primary.main,
  },

  bulkIcon: {
    borderColor: theme.palette.success.main,
    backgroundColor: theme.palette.action.hover,
    '& svg': {
      color: theme.palette.success.main,
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.success.main,
    }
  },

  showAllLabel: {
    marginLeft: 0,
    marginRight: 0,
    '& .MuiFormControlLabel-label': {
      fontSize: '0.8rem',
      color: '#4b5563',
      fontWeight: 600,
    },
  },

  bulkDialogText: {
    marginBottom: theme.spacing(1.5),
    color: '#4b5563',
  },

  bulkDialogControl: {
    minWidth: 220,
    width: "100%",
    marginBottom: theme.spacing(1.5),
    '& .MuiFormLabel-root': {
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: '#4b5563',
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 12,
      backgroundColor: '#ffffff',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      '& fieldset': {
        borderColor: '#e5e7eb',
      },
      '&:hover fieldset': {
        borderColor: '#0891b2',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#0891b2',
        boxShadow: '0 0 0 3px rgba(8, 145, 178, 0.12)',
      },
    },
    '& .MuiOutlinedInput-input': {
      fontSize: '0.875rem',
      padding: '10px 12px',
    },
  },

  serachInputWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
    display: 'flex',
    borderRadius: 14,
    padding: 6,
    marginRight: 0,
    border: '1px solid #e5e7eb',
    minHeight: 44,
    minWidth: 0,
  },

  searchIcon: {
    color: theme.palette.primary.main,
    marginLeft: 6,
    marginRight: 6,
    alignSelf: 'center',
  },

  searchInput: {
    flex: 1,
    border: 'none',
    borderRadius: 10,
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#1f2937',
    fontSize: '0.875rem',
    '&::placeholder': {
      color: '#9ca3af',
    },
  },

  badge: {
    right: '-8px',
    '& .MuiBadge-badge': {
      backgroundColor: theme.palette.success.main,
      color: theme.palette.getContrastText(theme.palette.success.main),
      fontWeight: 700,
      borderRadius: 999,
      minWidth: 20,
      height: 20,
    },
  },
  show: {
    display: 'block',
  },
  hide: {
    display: 'none !important',
  },
  dialogPaper: {
    borderRadius: 16,
    border: '1px solid #f3f4f6',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  },
  dialogTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#111827',
    borderBottom: '1px solid #f3f4f6',
  },
  dialogActions: {
    borderTop: '2px solid #f3f4f6',
    padding: '14px 20px',
    gap: theme.spacing(1),
  },
  cancelButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: 'none',
    padding: '9px 18px',
    color: '#374151',
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    '&:hover': {
      backgroundColor: '#e5e7eb',
      borderColor: '#d1d5db',
    },
  },
  confirmButton: {
    borderRadius: 12,
    fontWeight: 700,
    textTransform: 'none',
    padding: '9px 18px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    backgroundColor: '#0e7490',
    '&:hover': {
      backgroundColor: '#155e75',
    },
  },
  innerTabs: {
    borderBottom: '1px solid #f3f4f6',
    '& .MuiTabs-indicator': {
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.palette.success.main,
    },
  },
  innerTab: {
    minHeight: 48,
    textTransform: 'none',
    fontWeight: 600,
    color: '#6b7280',
    '&.Mui-selected': {
      color: theme.palette.success.main,
    },
  },
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const sortPreferenceStorageKey = "ticketsSortOrderPreference";

  const [searchParam, setSearchParam] = useState('');
  const [tab, setTab] = useState('open');
  const [tabOpen, setTabOpen] = useState('open');
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
  //const [newTicketGroupModalOpen, setNewTicketGroupModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const socketManager = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const userProfile = String(user?.profile || "");
  const { profile } = user || {};
  const isAdmin = String(profile || "").toLowerCase() === "admin";
  const userQueues = Array.isArray(user?.queues) ? user.queues : [];

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = userQueues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const selectedWhatsappIds = useMemo(() => [], []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sortOrder, setSortOrder] = useState(() => {
    const persistedValue = localStorage.getItem(sortPreferenceStorageKey);
    if (persistedValue === "asc" || persistedValue === "desc") {
      return persistedValue;
    }
    return "default";
  });
  const selectedDateRange = {
    from: '',
    until: '',
  };

  const [setClosedBox, setClosed] = useState(false);
  const [setGroupBox, setGroup] = useState(false);
  const [bulkCloseScope, setBulkCloseScope] = useState("queue");
  const [bulkQueueId, setBulkQueueId] = useState("");
  const [bulkWhatsappId, setBulkWhatsappId] = useState("");
  const [bulkQueues, setBulkQueues] = useState([]);
  const [bulkWhatsapps, setBulkWhatsapps] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadTicketViewSettings = async () => {
      let settings = [];

      try {
        const { data } = await api.get('/settings/');
        settings = Array.isArray(data) ? data : [];
      } catch (err) {
        toastError(err);
      }

      const isAdminUser = userProfile.toLowerCase() === 'admin';
      const canViewClosed = settings.find((s) => s.key === 'viewclosed')?.value === 'enabled' || isAdminUser;
      const canViewGroups = settings.find((s) => s.key === 'viewgroups')?.value === 'enabled' || isAdminUser;

      if (!isMounted) return;

      setClosed(canViewClosed);
      setGroup(canViewGroups);
    };

    loadTicketViewSettings();

    return () => {
      isMounted = false;
    };
  }, [userProfile]);

  useEffect(() => {
    if (userProfile.toUpperCase() === 'ADMIN') {
      setShowAllTickets(true);
    }
  }, [userProfile]);

  useEffect(() => {
    if (tab === 'search') {
      searchInputRef.current.focus();
    }
  }, [tab]);

  useEffect(() => {
    if (!ticketId) return;
    setTab("open");
    setTabOpen("open");
  }, [ticketId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId) return;

    const socket = socketManager.getSocket(companyId);
    const eventName = `company-${companyId}-ticket`;

    const handleIncomingPending = (data) => {
      if (ticketId) return;
      if (!data || data.action !== "update" || !data.ticket) return;
      if (data.ticket.status !== "pending") return;
      setTab("open");
      setTabOpen("pending");
    };

    socket.on(eventName, handleIncomingPending);

    return () => {
      socket.off(eventName, handleIncomingPending);
      socket.disconnect();
    };
  }, [socketManager, ticketId]);

  useEffect(() => {
    const loadTargets = async () => {
      if (!isAdmin) return;

      try {
        const [{ data: whatsappsData }, { data: queuesData }] = await Promise.all([
          api.get("/whatsapp"),
          api.get("/queue"),
        ]);

        const normalizedWhatsapps = Array.isArray(whatsappsData)
          ? whatsappsData.map((whatsapp) => ({ id: Number(whatsapp.id), name: whatsapp.name }))
          : [];
        setBulkWhatsapps(normalizedWhatsapps);

        if (!bulkWhatsappId && normalizedWhatsapps.length > 0) {
          setBulkWhatsappId(String(normalizedWhatsapps[0].id));
        }

        const normalizedQueues = Array.isArray(queuesData)
          ? queuesData.map((queue) => ({ id: Number(queue.id), name: queue.name }))
          : [];
        setBulkQueues(normalizedQueues);
        if (!bulkQueueId && normalizedQueues.length > 0) {
          setBulkQueueId(String(normalizedQueues[0].id));
        }
      } catch (err) {
        toastError(err);
      }
    };

    loadTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (bulkCloseScope !== "queue") return;
    if (!Array.isArray(selectedQueueIds) || selectedQueueIds.length !== 1) return;
    setBulkQueueId(String(selectedQueueIds[0]));
  }, [bulkCloseScope, selectedQueueIds]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === '') {
      setSearchParam(searchedTerm);
      setTab('open');
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleBulkModalOpen = () => {
    setBulkCloseModalOpen(true);
  };

  const handleBulkModalClose = () => {
    setBulkCloseModalOpen(false);
  };


  const CloseAllTicket = async () => {
    try {
      if (bulkCloseScope === "queue" && !bulkQueueId) {
        toast.warn("Selecione uma fila para finalizar em massa.");
        return;
      }

      if (bulkCloseScope === "whatsapp" && !bulkWhatsappId) {
        toast.warn("Selecione uma conexao para finalizar em massa.");
        return;
      }

      const payload = bulkCloseScope === "queue"
        ? { queueId: Number(bulkQueueId) }
        : bulkCloseScope === "whatsapp"
          ? { whatsappId: Number(bulkWhatsappId) }
          : { scope: "unassigned", withoutQueueAndWhatsapp: true };

      const { data } = await api.post("/tickets/closeAll", payload);
      const count = Number(data?.closedCount || 0);
      if (count > 0) {
        toast.success(`${count} ticket(s) finalizado(s) com sucesso.`);
      } else {
        toast.success("Nenhum ticket aberto/pendente encontrado para este filtro.");
      }

      handleBulkModalClose();

    } catch (err) {
      toastError(err);
    }
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return {
        display: "none",
        width: 0,
        height: 0,
        minHeight: 0,
        border: 0,
        overflow: "hidden"
      };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  const handleSortOrderChange = (event) => {
    const nextValue = String(event.target.value || "default");
    setSortOrder(nextValue);
    if (nextValue === "asc" || nextValue === "desc") {
      localStorage.setItem(sortPreferenceStorageKey, nextValue);
      return;
    }
    localStorage.removeItem(sortPreferenceStorageKey);
  };

  const sortOrderParam = sortOrder === "default" ? undefined : sortOrder;

  const isBulkActionDisabled =
    bulkCloseScope === "queue"
      ? !bulkQueueId
      : bulkCloseScope === "whatsapp"
        ? !bulkWhatsappId
        : false;

  return (
    <Paper elevation={0} variant='outlined' className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          // console.log('ticket', ticket);
          handleCloseOrOpenTicket(ticket);
        }}
      />

      <Dialog
        open={bulkCloseModalOpen}
        onClose={handleBulkModalClose}
        aria-labelledby='bulk-close-modal-title'
        maxWidth='xs'
        fullWidth
        PaperProps={{ className: classes.dialogPaper }}
      >
        <DialogTitle id='bulk-close-modal-title' className={classes.dialogTitle}>Finalizar em massa</DialogTitle>
        <DialogContent>
          <DialogContentText className={classes.bulkDialogText}>
            Escolha o tipo de filtro para finalizar atendimentos abertos e aguardando.
          </DialogContentText>

          <FormControl
            size='small'
            variant='outlined'
            className={classes.bulkDialogControl}
          >
            <InputLabel id='bulk-close-scope-label'>Escopo</InputLabel>
            <Select
              labelId='bulk-close-scope-label'
              value={bulkCloseScope}
              onChange={(event) => setBulkCloseScope(String(event.target.value))}
              label='Escopo'
            >
              <MenuItem value='queue'>Fila</MenuItem>
              <MenuItem value='whatsapp'>Conexao</MenuItem>
              <MenuItem value='unassigned'>Sem fila e sem conexao</MenuItem>
            </Select>
          </FormControl>

          {bulkCloseScope === "queue" ? (
            <FormControl
              size='small'
              variant='outlined'
              className={classes.bulkDialogControl}
            >
              <InputLabel id='bulk-close-queue-label'>Fila alvo</InputLabel>
              <Select
                labelId='bulk-close-queue-label'
                value={bulkQueueId}
                onChange={(event) => setBulkQueueId(String(event.target.value))}
                label='Fila alvo'
              >
                {bulkQueues.length > 0 ? (
                  bulkQueues.map((queue) => (
                    <MenuItem key={queue.id} value={String(queue.id)}>
                      {queue.name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value=''>
                    Nenhuma fila encontrada
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          ) : bulkCloseScope === "whatsapp" ? (
            <FormControl
              size='small'
              variant='outlined'
              className={classes.bulkDialogControl}
            >
              <InputLabel id='bulk-close-whatsapp-label'>Conexao alvo</InputLabel>
              <Select
                labelId='bulk-close-whatsapp-label'
                value={bulkWhatsappId}
                onChange={(event) => setBulkWhatsappId(String(event.target.value))}
                label='Conexao alvo'
              >
                {bulkWhatsapps.length > 0 ? (
                  bulkWhatsapps.map((whatsapp) => (
                    <MenuItem key={whatsapp.id} value={String(whatsapp.id)}>
                      {whatsapp.name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value=''>
                    Nenhuma conexao encontrada
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          ) : (
            <DialogContentText className={classes.bulkDialogText}>
              Este modo vai finalizar apenas tickets abertos/aguardando que estejam sem fila e sem conexao.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button onClick={handleBulkModalClose} variant='outlined' className={classes.cancelButton}>Cancelar</Button>
          <Button
            variant='contained'
            color='primary'
            onClick={CloseAllTicket}
            disabled={isBulkActionDisabled}
            className={classes.confirmButton}
          >
            Finalizar
          </Button>
        </DialogActions>
      </Dialog>

      {/*<NewTicketGroupModal
        modalOpen={newTicketGroupModalOpen}
        onClose={(ticket) => {
          handleCloseOrOpenTicketGroup(ticket);
        }}
      />*/}

      {setClosedBox && (
        <>
          <Paper elevation={0} square className={classes.tabsHeader}>
            <Tabs
              value={tab}
              onChange={handleChangeTab}
              variant='fullWidth'
              indicatorColor='primary'
              textColor='primary'
              aria-label='icon label tabs example'
            >
              <Tab
                value={'open'}
                icon={<ChatIcon />}
                title='Conversas'
                classes={{ root: classes.tab }}
              />
              {setGroupBox && (
                <Tab
                  value={'group'}
                  icon={<GroupIcon />}
                  title='Grupos'
                  classes={{ root: classes.tab }}
                />
              )}
              <Tab
                value={'closed'}
                icon={<DoneAllIcon />}
                title='Conversas Finalizadas'
                classes={{ root: classes.tab }}
              />
              <Tab
                value={'search'}
                icon={<SearchIcon />}
                title='Pesquisar Conversas'
                classes={{ root: classes.tab }}
              />
            </Tabs>
          </Paper>
        </>
      )}

      {!setClosedBox && (
        <>
          <Paper elevation={0} square className={classes.tabsHeader}>
            <Tabs
              value={tab}
              onChange={handleChangeTab}
              variant='fullWidth'
              indicatorColor='primary'
              textColor='primary'
              aria-label='icon label tabs example'
            >
              <Tab
                value={'open'}
                icon={<ChatIcon />}
                title='Conversas'
                classes={{ root: classes.tab }}
              />
              {setGroupBox && (
                <Tab
                  value={'group'}
                  icon={<GroupIcon />}
                  title='Grupos'
                  classes={{ root: classes.tab }}
                />
              )}
            </Tabs>
          </Paper>
        </>
      )}

      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        <div className={classes.actionsRow}>
          {tab === 'search' ? (
            <div className={classes.serachInputWrapper}>
              <SearchIcon className={classes.searchIcon} />
              <InputBase
                className={classes.searchInput}
                inputRef={searchInputRef}
                placeholder={i18n.t('tickets.search.placeholder')}
                type='search'
                onChange={handleSearch}
              />
            </div>
          ) : (
            <>
              {(tab === 'open' || tab === 'closed') && (
                <IconButton
                  className={classes.button}
                  onClick={() => {
                    setNewTicketModalOpen(true);
                  }}
                  title='Novo atendimento'
                >
                  <AddIcon className={classes.icon} />
                </IconButton>
              )}

              {isAdmin && (
                <IconButton
                  className={`${classes.button} ${classes.bulkIcon}`}
                  onClick={handleBulkModalOpen}
                  title='Finalizar em massa'
                >
                  <PlaylistAddCheckOutlinedIcon />
                </IconButton>
              )}

              <Can
                role={user.profile}
                perform='tickets-manager:showall'
                yes={() => (
                  <FormControlLabel
                    className={classes.showAllLabel}
                    label={i18n.t('tickets.buttons.showAll')}
                    labelPlacement='start'
                    control={
                      <Switch
                        size='small'
                        checked={showAllTickets}
                        onChange={() =>
                          setShowAllTickets((prevState) => !prevState)
                        }
                        name='showAllTickets'
                        color='primary'
                      />
                    }
                  />
                )}
              />
            </>
          )}
        </div>

        <TicketsQueueSelect
          style={{ marginLeft: 0 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={userQueues}
          onChange={(values) => setSelectedQueueIds(values)}
        />
        <FormControl
          size='small'
          variant='outlined'
          style={{ minWidth: 150 }}
        >
          <InputLabel id='tickets-sort-order-label'>Ordenação</InputLabel>
          <Select
            labelId='tickets-sort-order-label'
            value={sortOrder}
            onChange={handleSortOrderChange}
            label='Ordenação'
          >
            <MenuItem value='default'>Padrão</MenuItem>
            <MenuItem value='asc'>Mais antigos</MenuItem>
            <MenuItem value='desc'>Mais recentes</MenuItem>
          </Select>
        </FormControl>
      </Paper>
      <TabPanel value={tab} name='open' className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor='primary'
          textColor='primary'
          variant='fullWidth'
          className={classes.innerTabs}
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color='primary'
              >
                {i18n.t('ticketsList.assignedHeader')}
              </Badge>
            }
            value={'open'}
            className={classes.innerTab}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color='primary'
              >
                {i18n.t('ticketsList.pendingHeader')}
              </Badge>
            }
            value={'pending'}
            className={classes.innerTab}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status='open'
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle('open')}
            sortOrder={sortOrderParam}
          />
          <TicketsList
            status='pending'
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle('pending')}
            sortOrder={sortOrderParam}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tab} name='group' className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor='primary'
          textColor='primary'
          variant='fullWidth'
          className={classes.innerTabs}
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color='primary'
              >
                {i18n.t('ticketsList.assignedHeader')}
              </Badge>
            }
            value={'open'}
            className={classes.innerTab}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color='primary'
              >
                {i18n.t('ticketsList.pendingHeader')}
              </Badge>
            }
            value={'pending'}
            className={classes.innerTab}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsListGroup
            status='open'
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle('open')}
            sortOrder={sortOrderParam}
          />
          <TicketsListGroup
            status='pending'
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle('pending')}
            sortOrder={sortOrderParam}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tab} name='closed' className={classes.ticketsWrapper}>
        <TicketsList
          status='closed'
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          selectedWhatsappIds={selectedWhatsappIds}
        />
        {setGroupBox && (
          <TicketsListGroup
            status='closed'
            showAll={true}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
          />
        )}
      </TabPanel>
      <TabPanel value={tab} name='search' className={classes.ticketsWrapper}>
        <TagsFilter onFiltered={handleSelectedTags} />
        {(profile === 'admin') && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}
        <TicketsList
          dateRange={selectedDateRange}
          searchParam={searchParam}
          showAll={true}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
          selectedWhatsappIds={selectedWhatsappIds}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;

