% N number of oscillator nodes
% K number of jumps of CTMC
% L vector time (jump) of last switch of each node relative to present
% Lmax maximum value of L

% Y binary matrix of N x Lmax+1 entries that encode past node states
% Column 1 is current time and Lmax+1 is oldest past
% Y changes size during execution

% X current state of oscillator nodes which is last column of Y
% VC current value set to 1 wlog
% small_eps small term that makes all rates strictly positive

% CTMC state is (L,Y)

% Rates of CTMC are determined using given (partial) state vector X and 
% small_eps using function rnode(i,N,X,small_eps) which returns a value at 
% least small_eps for given node i
% q column vector of rates of change of each node
% Toss independent exponentials with the given rates and choose minimum
% Value determines holding time of state and arg min the node that switches

% INPUT : 
% CMat -  Clause by variable dependency matrix
% var - Number of variable

% OUTPUT :
% X - Final SAT solution of MCMC algorithm
% time_to_sat - Time to reach SAT solution


function [X,time_to_sat] = MCMC_SAT(CMat,var,nc)

N=var;
K=10^4;
VC=1;
small_eps=0.00;

% Initializing oscillator nodes and state variables
X=binornd(ones(N,1),0.5); % Uniformly generating initial state
L=zeros(N,1); % Initially all nodes have full current
Lmax=max(L); % Initially equal to 0
Y=X; % Size is N x (Lmax+1)

rate_flag = zeros(N,K+1);
% unsatis = zeros(N,K+1);
 
QV = ones(K+1,N)/VC;
% Simulating for K jumps


%Parameter to check the rate to 10^6
rate_cap =10^6;


L=zeros(N,1);
Lmax=max(L);
Y=X;
tic;
for i=2:K+1

    Xtmp=X;
    Ltmp=L;
    Lmaxtmp=Lmax;

    [vtmpj,vtmp]=rnode_MCMC(N,X,small_eps,CMat,nc);
    for j=1:N
        tmp=1/VC;
        if vtmpj(j) ==0
            rate_flag(j,i)=1;
            q(j) =QV(i-1,j);
            L(j)=L(j)+1;
        else
            if L(j)>0
                q(j)= vtmpj(j)*QV(i-1,j);
            else
                q(j)=vtmpj(j);
            end
        end
    end
    % Termination condition when all rates are 0
    if vtmp==0
        break;
    end
    CFV(i)=sum(vtmp);
    QV(i,1:N)=q;
    times=exprnd(1./q);
    [r]=find(rate_flag(:,i)==0);
    [Tval,Ival]=min(times(r));
    if(i==2)
        TvalV(i)=Tval;
    else
        TvalV(i)=TvalV(i-1)+Tval;
    end
    for j=r'
        if(j==r(Ival)) % Node that switches
            L(j)=0;
            if X(j)==1
                X(j)=0;
            else
                X(j)=1;
            end
        else
            L(j)=L(j)+1; % X components stay the same so no change
        end
    end
    Lmax=max(L);
end
%SAT
time_to_sat=TvalV(end);
end